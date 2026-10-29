"""
Official Instagram Graph API Connector for CyberTech AI.
Retrieves public post/reel comments and replies using official Instagram Graph API endpoints.
References:
https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/media/comments
"""
import re
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
import httpx
from app.core.config import settings
from app.connectors.base import BaseSocialConnector, NormalizedSocialComment, ConnectorStatus

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.facebook.com/v20.0"


class InstagramConnector(BaseSocialConnector):
    """Connector for official Instagram Graph API."""

    def __init__(self):
        super().__init__("instagram")

    def get_credential(self) -> Optional[str]:
        if self._runtime_credential and self._runtime_credential.strip():
            return self._runtime_credential.strip()
        env_token = getattr(settings, "INSTAGRAM_ACCESS_TOKEN", None)
        if env_token and isinstance(env_token, str) and env_token.strip():
            return env_token.strip()
        import os
        os_token = os.environ.get("INSTAGRAM_ACCESS_TOKEN")
        if os_token and os_token.strip():
            return os_token.strip()
        return None

    @staticmethod
    def extract_media_id(input_str: str) -> Optional[str]:
        """
        Extracts Instagram Media ID or shortcode from post/reel/tv URL or bare identifier.
        Supports:
          - https://www.instagram.com/p/{shortcode}/
          - https://instagram.com/reel/{shortcode}/
          - https://www.instagram.com/tv/{shortcode}/
          - https://www.instagram.com/share/p/{shortcode}/
          - Bare numeric ID: 17989355321012345
          - Bare shortcode: C1xYz_aB9
        """
        if not input_str:
            return None
        clean = input_str.strip().strip('"').strip("'")
        if not clean:
            return None

        # 1. Bare numeric media ID (e.g. 17989355321012345)
        if re.match(r"^\d{5,30}$", clean):
            return clean

        # 2. Instagram URL patterns
        url_match = re.search(
            r"(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv|share\/p)\/([a-zA-Z0-9_\-]+)",
            clean,
            re.IGNORECASE
        )
        if url_match:
            return url_match.group(1)

        # 3. Direct alphanumeric shortcode (e.g., C1xYz_aB9)
        if re.match(r"^[a-zA-Z0-9_\-]{5,25}$", clean) and not clean.startswith("http"):
            return clean

        return None

    async def check_connection(self) -> ConnectorStatus:
        """Verify Instagram Access Token validity and Graph API accessibility."""
        token = self.get_credential()
        if not token:
            return ConnectorStatus(
                platform="instagram",
                is_configured=False,
                status="unconfigured",
                message="Instagram Access Token is not configured on the server. Contact the service administrator to configure INSTAGRAM_ACCESS_TOKEN in the server environment.",
                last_sync_timestamp=self.last_sync_timestamp,
            )

        headers = {
            "Authorization": f"Bearer {token}",
            "User-Agent": "CyberTechAI-Moderation/2.0"
        }
        try:
            async with httpx.AsyncClient() as client:
                resp = await self._request_with_retry(
                    client,
                    "GET",
                    f"{GRAPH_API_BASE}/me",
                    headers=headers,
                    params={"fields": "id,name"},
                    max_retries=1
                )
                if resp.status_code == 200:
                    account_data = resp.json()
                    acc_name = account_data.get("name") or account_data.get("id") or "Instagram Account"
                    return ConnectorStatus(
                        platform="instagram",
                        is_configured=True,
                        status="ready",
                        message=f"Connected to Instagram Graph API v20.0 ({acc_name}). Ready for comment ingestion.",
                        last_sync_timestamp=self.last_sync_timestamp,
                        account_info=acc_name,
                        rate_limit_info={"endpoint": "/me", "status": "authorized"}
                    )
                elif resp.status_code == 401:
                    return ConnectorStatus(
                        platform="instagram",
                        is_configured=False,
                        status="error",
                        message="Instagram API Authentication Failed (401 Unauthorized): Access token is invalid or expired.",
                        last_sync_timestamp=self.last_sync_timestamp
                    )
                elif resp.status_code == 403:
                    err_msg = resp.json().get("error", {}).get("message", "Permission Denied")
                    return ConnectorStatus(
                        platform="instagram",
                        is_configured=True,
                        status="error",
                        message=(
                            f"Instagram API Permission Restriction (403 Forbidden): '{err_msg}'. "
                            "Ensure the access token has 'instagram_basic' and 'instagram_manage_comments' permissions."
                        ),
                        last_sync_timestamp=self.last_sync_timestamp
                    )
                elif resp.status_code == 429:
                    return ConnectorStatus(
                        platform="instagram",
                        is_configured=True,
                        status="rate_limited",
                        message="Instagram Graph API Rate Limit Exceeded (429). Rate limit resets periodically.",
                        last_sync_timestamp=self.last_sync_timestamp
                    )
                else:
                    return ConnectorStatus(
                        platform="instagram",
                        is_configured=True,
                        status="error",
                        message=f"Instagram API returned HTTP {resp.status_code}: {resp.text[:120]}",
                        last_sync_timestamp=self.last_sync_timestamp
                    )
        except Exception as e:
            return ConnectorStatus(
                platform="instagram",
                is_configured=True,
                status="error",
                message=f"Network error contacting Instagram Graph API: {str(e)}",
                last_sync_timestamp=self.last_sync_timestamp
            )

    async def fetch_comments(
        self,
        media_input: str,
        max_comments: int = 50,
        include_replies: bool = True,
        access_token_override: Optional[str] = None
    ) -> Tuple[List[NormalizedSocialComment], Dict[str, Any]]:
        """
        Fetches top-level comments and optional replies from Instagram Graph API for a given Media ID or URL.
        """
        token = access_token_override or self.get_credential()
        if not token or not token.strip():
            raise ValueError(
                "Instagram Access Token is not configured on the server. Please contact the service administrator to configure INSTAGRAM_ACCESS_TOKEN in the server environment."
            )

        clean_input = media_input.strip().strip('"').strip("'")
        media_id = self.extract_media_id(clean_input)
        if not media_id:
            raise ValueError(
                f"Invalid Instagram post/reel URL or media identifier: '{clean_input}'. Expected format: https://www.instagram.com/p/<shortcode>/ or numeric Media ID."
            )

        headers = {
            "Authorization": f"Bearer {token.strip()}",
            "User-Agent": "CyberTechAI-Moderation/2.0"
        }
        max_to_fetch = max(5, min(max_comments, 100))
        comments: List[NormalizedSocialComment] = []

        fields = "id,text,timestamp,username,like_count"
        if include_replies:
            fields += ",replies{id,text,timestamp,username,like_count}"

        async with httpx.AsyncClient() as client:
            endpoint_url = f"{GRAPH_API_BASE}/{media_id}/comments"
            params = {
                "fields": fields,
                "limit": min(max_to_fetch, 50)
            }

            try:
                resp = await self._request_with_retry(
                    client,
                    "GET",
                    endpoint_url,
                    headers=headers,
                    params=params,
                    max_retries=2
                )
            except Exception as exc:
                raise RuntimeError(f"Network error contacting Instagram Graph API: {str(exc)}")

            if resp.status_code == 401:
                raise PermissionError("Instagram API Authentication Failed (401 Unauthorized): Access token is invalid or expired.")
            elif resp.status_code == 403:
                err_detail = resp.json().get("error", {}).get("message", "Permission Denied")
                raise PermissionError(f"Instagram API Access Denied (403 Forbidden): '{err_detail}'. Verify token permissions.")
            elif resp.status_code == 404:
                raise ValueError(f"Instagram media '{media_id}' was not found or is set to private.")
            elif resp.status_code == 400:
                err_msg = resp.json().get("error", {}).get("message", resp.text)
                raise ValueError(f"Instagram API Bad Request: {err_msg}")
            elif resp.status_code != 200:
                raise RuntimeError(f"Instagram API returned unexpected status {resp.status_code}: {resp.text[:140]}")

            payload = resp.json()
            data_items = payload.get("data", [])

            for item in data_items:
                cid = item.get("id")
                text = (item.get("text") or "").strip()
                if not text:
                    continue

                username = item.get("username") or "Instagram User"
                ts_str = item.get("timestamp")
                dt = None
                if ts_str:
                    try:
                        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00")).replace(tzinfo=None)
                    except Exception:
                        dt = datetime.utcnow()

                source_url = f"https://www.instagram.com/p/{media_id}/" if not media_id.isdigit() else f"https://www.instagram.com/"

                comments.append(NormalizedSocialComment(
                    platform="instagram",
                    comment_id=cid,
                    text=text,
                    author_name=username,
                    published_at=dt or datetime.utcnow(),
                    source_url=source_url,
                    target_id=media_id,
                    raw_metadata={
                        "like_count": item.get("like_count", 0),
                        "is_reply": False
                    }
                ))

                # Handle nested replies if included
                if include_replies and "replies" in item:
                    reply_items = item["replies"].get("data", [])
                    for rep in reply_items:
                        r_text = (rep.get("text") or "").strip()
                        if not r_text:
                            continue
                        r_id = rep.get("id")
                        r_user = rep.get("username") or "Instagram User"
                        r_ts_str = rep.get("timestamp")
                        r_dt = None
                        if r_ts_str:
                            try:
                                r_dt = datetime.fromisoformat(r_ts_str.replace("Z", "+00:00")).replace(tzinfo=None)
                            except Exception:
                                r_dt = datetime.utcnow()

                        comments.append(NormalizedSocialComment(
                            platform="instagram",
                            comment_id=r_id,
                            text=r_text,
                            author_name=r_user,
                            published_at=r_dt or datetime.utcnow(),
                            source_url=source_url,
                            parent_id=cid,
                            target_id=media_id,
                            raw_metadata={
                                "like_count": rep.get("like_count", 0),
                                "is_reply": True,
                                "parent_comment_id": cid
                            }
                        ))
                        if len(comments) >= max_to_fetch:
                            break

                if len(comments) >= max_to_fetch:
                    break

        self.last_sync_timestamp = datetime.utcnow().isoformat()
        metadata = {
            "media_id": media_id,
            "total_returned": len(comments),
            "source_type": "instagram_graph_api",
            "timestamp": self.last_sync_timestamp,
        }
        return comments, metadata
