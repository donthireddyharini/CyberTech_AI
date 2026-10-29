"""
Official YouTube Data API v3 Connector for CyberTech AI.
Retrieves public video comment threads and replies using official Google APIs.
Reference: https://developers.google.com/youtube/v3/docs/commentThreads/list
"""
import re
import html
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
import httpx
from app.core.config import settings
from app.connectors.base import BaseSocialConnector, NormalizedSocialComment, ConnectorStatus

logger = logging.getLogger(__name__)

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"


class YouTubeConnector(BaseSocialConnector):
    """Connector for official YouTube Data API v3."""

    def __init__(self):
        super().__init__("youtube")

    def get_credential(self) -> Optional[str]:
        if self._runtime_credential and self._runtime_credential.strip():
            return self._runtime_credential.strip()
        env_key = getattr(settings, "YOUTUBE_API_KEY", None)
        if env_key and isinstance(env_key, str) and env_key.strip():
            return env_key.strip()
        return None

    @staticmethod
    def extract_video_id(input_str: str) -> Optional[str]:
        """
        Extracts standard 11-character YouTube video ID from URL or raw ID.
        Supports:
          - Standard: https://www.youtube.com/watch?v=VIDEO_ID (and extra query params)
          - Shortened: https://youtu.be/VIDEO_ID
          - Shorts: https://www.youtube.com/shorts/VIDEO_ID
          - Live: https://www.youtube.com/live/VIDEO_ID
          - Embed: https://www.youtube.com/embed/VIDEO_ID
          - Bare ID: 11 alphanumeric/dash/underscore chars
        """
        if not input_str:
            return None
        clean = input_str.strip().strip('"').strip("'")

        # Bare 11-char ID
        if re.match(r"^[a-zA-Z0-9_-]{11}$", clean):
            return clean

        patterns = [
            r"(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([a-zA-Z0-9_-]{11})",
            r"[?&]v=([a-zA-Z0-9_-]{11})",
            r"(?:youtube\.com\/(?:watch\?.*v=|v\/|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})",
        ]
        for pat in patterns:
            match = re.search(pat, clean)
            if match:
                return match.group(1)
        return None

    async def check_connection(self) -> ConnectorStatus:
        """Verify API key availability and status."""
        key = self.get_credential()
        if not key:
            return ConnectorStatus(
                platform="youtube",
                is_configured=False,
                status="unconfigured",
                message="YouTube API Key is not configured on the server. Contact the service administrator to configure YOUTUBE_API_KEY.",
                last_sync_timestamp=self.last_sync_timestamp,
            )

        # Lightweight check: query YouTube API categories or test key
        try:
            async with httpx.AsyncClient() as client:
                resp = await self._request_with_retry(
                    client,
                    "GET",
                    f"{YOUTUBE_API_BASE}/videoCategories",
                    params={"part": "snippet", "regionCode": "US", "key": key},
                    max_retries=1
                )
                if resp.status_code == 200:
                    return ConnectorStatus(
                        platform="youtube",
                        is_configured=True,
                        status="ready",
                        message="Connected to YouTube Data API v3. Ready for comment ingestion.",
                        last_sync_timestamp=self.last_sync_timestamp,
                        rate_limit_info={"daily_quota_units": 10000, "operation": "commentThreads.list (1 unit)"}
                    )
                elif resp.status_code == 400:
                    data = resp.json().get("error", {})
                    reason = data.get("errors", [{}])[0].get("reason", "keyInvalid")
                    return ConnectorStatus(
                        platform="youtube",
                        is_configured=False,
                        status="error",
                        message=f"YouTube API Key rejected: {reason}. Verify your Google Cloud Console credentials.",
                        last_sync_timestamp=self.last_sync_timestamp
                    )
                elif resp.status_code == 403:
                    data = resp.json().get("error", {})
                    reason = data.get("errors", [{}])[0].get("reason", "forbidden")
                    return ConnectorStatus(
                        platform="youtube",
                        is_configured=True,
                        status="rate_limited" if "quota" in reason.lower() else "error",
                        message=f"YouTube API access restriction: {reason}.",
                        last_sync_timestamp=self.last_sync_timestamp
                    )
                else:
                    return ConnectorStatus(
                        platform="youtube",
                        is_configured=True,
                        status="error",
                        message=f"YouTube API returned HTTP {resp.status_code}.",
                        last_sync_timestamp=self.last_sync_timestamp
                    )
        except Exception as e:
            return ConnectorStatus(
                platform="youtube",
                is_configured=True,
                status="error",
                message=f"Network error contacting YouTube API: {str(e)}",
                last_sync_timestamp=self.last_sync_timestamp
            )

    async def fetch_comments(
        self,
        target_input: Optional[str] = None,
        max_comments: int = 50,
        include_replies: bool = True,
        order: str = "relevance",
        api_key_override: Optional[str] = None,
        video_url_or_id: Optional[str] = None
    ) -> Tuple[List[NormalizedSocialComment], Dict[str, Any]]:
        """
        Fetches public comment threads and replies for a given YouTube video.
        Returns:
            (List[NormalizedSocialComment], stats_dict)
        """
        key = api_key_override or self.get_credential()
        if not key or not key.strip():
            raise ValueError(
                "YouTube API Key is not configured on the server. Please contact the service administrator to configure YOUTUBE_API_KEY in the server environment."
            )

        raw_target = target_input or video_url_or_id
        if not raw_target:
            raise ValueError("YouTube video URL or Video ID cannot be empty.")

        video_id = self.extract_video_id(raw_target)
        if not video_id:
            raise ValueError(
                f"Invalid YouTube URL or Video ID: '{raw_target}'. Expected format: https://youtube.com/watch?v=VIDEO_ID, https://youtu.be/VIDEO_ID, or 11-char ID."
            )

        max_to_fetch = max(1, min(max_comments, 200))
        comments: List[NormalizedSocialComment] = []
        page_token: Optional[str] = None
        pages_retrieved = 0
        quota_used = 0
        api_order = "time" if order == "time" else "relevance"
        part_param = "snippet,replies" if include_replies else "snippet"

        async with httpx.AsyncClient() as client:
            while len(comments) < max_to_fetch:
                batch_limit = min(100, max_to_fetch - len(comments))
                params = {
                    "part": part_param,
                    "videoId": video_id,
                    "maxResults": batch_limit,
                    "textFormat": "plainText",
                    "order": api_order,
                    "key": key.strip()
                }
                if page_token:
                    params["pageToken"] = page_token

                resp = await self._request_with_retry(
                    client,
                    "GET",
                    f"{YOUTUBE_API_BASE}/commentThreads",
                    params=params
                )
                quota_used += 1

                if resp.status_code != 200:
                    err_json = {}
                    try:
                        err_json = resp.json().get("error", {})
                    except Exception:
                        pass
                    errors = err_json.get("errors", [])
                    reason = errors[0].get("reason", "") if errors else ""
                    msg = err_json.get("message", f"HTTP {resp.status_code}")

                    if reason == "commentsDisabled":
                        logger.info(f"[youtube] Comments are disabled for video {video_id}.")
                        break
                    elif reason == "videoNotFound":
                        raise ValueError(f"YouTube video '{video_id}' not found or is private.")
                    elif reason == "quotaExceeded":
                        raise RuntimeError("YouTube Data API quota exceeded for today. Try again tomorrow or raise quota in Google Cloud Console.")
                    elif resp.status_code == 400:
                        raise ValueError(f"YouTube API request error: {msg}")
                    elif resp.status_code == 403:
                        raise PermissionError(f"YouTube API permission error: {msg}")
                    else:
                        raise RuntimeError(f"YouTube API error: {msg} (HTTP {resp.status_code})")

                data = resp.json()
                items = data.get("items", [])
                if not items:
                    break

                for item in items:
                    snippet = item.get("snippet", {})
                    top_comment = snippet.get("topLevelComment", {}).get("snippet", {})
                    cid = item.get("id") or top_comment.get("id")
                    raw_text = top_comment.get("textOriginal") or top_comment.get("textDisplay", "")
                    text = html.unescape(raw_text).strip()
                    author_name = top_comment.get("authorDisplayName", "YouTube User")
                    author_channel = top_comment.get("authorChannelId", {}).get("value")
                    pub_time_str = top_comment.get("publishedAt")
                    pub_dt = None
                    if pub_time_str:
                        try:
                            pub_dt = datetime.fromisoformat(pub_time_str.replace("Z", "+00:00")).replace(tzinfo=None)
                        except Exception:
                            pub_dt = datetime.utcnow()

                    if text and cid:
                        comments.append(NormalizedSocialComment(
                            platform="youtube",
                            comment_id=cid,
                            text=text,
                            author_id=author_channel,
                            author_name=author_name,
                            published_at=pub_dt or datetime.utcnow(),
                            source_url=f"https://www.youtube.com/watch?v={video_id}&lc={cid}",
                            parent_id=None,
                            target_id=video_id,
                            raw_metadata={
                                "like_count": top_comment.get("likeCount", 0),
                                "total_reply_count": snippet.get("totalReplyCount", 0),
                                "video_id": video_id
                            }
                        ))

                    # Process replies if requested and present
                    if include_replies:
                        replies_data = item.get("replies", {}).get("comments", [])
                        for reply in replies_data:
                            if len(comments) >= max_to_fetch:
                                break
                            r_snippet = reply.get("snippet", {})
                            r_id = reply.get("id")
                            raw_reply = r_snippet.get("textOriginal") or r_snippet.get("textDisplay", "")
                            r_text = html.unescape(raw_reply).strip()
                            r_author = r_snippet.get("authorDisplayName", "YouTube User")
                            r_author_id = r_snippet.get("authorChannelId", {}).get("value")
                            r_pub_time = r_snippet.get("publishedAt")
                            r_dt = None
                            if r_pub_time:
                                try:
                                    r_dt = datetime.fromisoformat(r_pub_time.replace("Z", "+00:00")).replace(tzinfo=None)
                                except Exception:
                                    r_dt = datetime.utcnow()

                            if r_text and r_id:
                                comments.append(NormalizedSocialComment(
                                    platform="youtube",
                                    comment_id=r_id,
                                    text=r_text,
                                    author_id=r_author_id,
                                    author_name=r_author,
                                    published_at=r_dt or datetime.utcnow(),
                                    source_url=f"https://www.youtube.com/watch?v={video_id}&lc={r_id}",
                                    parent_id=cid,
                                    target_id=video_id,
                                    raw_metadata={
                                        "like_count": r_snippet.get("likeCount", 0),
                                        "video_id": video_id,
                                        "is_reply": True
                                    }
                                ))

                pages_retrieved += 1
                page_token = data.get("nextPageToken")
                if not page_token:
                    break

        self.last_sync_timestamp = datetime.utcnow().isoformat()
        stats = {
            "platform": "youtube",
            "video_id": video_id,
            "total_fetched": len(comments),
            "pages_retrieved": pages_retrieved,
            "quota_units_used": quota_used,
            "timestamp": self.last_sync_timestamp
        }
        logger.info(f"[youtube] Successfully fetched {len(comments)} comments from video {video_id}.")
        return comments, stats
