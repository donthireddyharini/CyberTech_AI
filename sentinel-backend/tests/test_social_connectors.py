"""
Tests for CyberTech AI Social Connectors & Ingestion Pipeline.
Verifies YouTube and Instagram Graph API parsers, server-configured connector statuses, error diagnostics, and API endpoints.
Verifies that Twitter/X endpoints have been completely replaced with Instagram.
"""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
import httpx
from main import app
from app.core.database import create_tables, AsyncSessionLocal
from app.connectors.youtube import YouTubeConnector
from app.connectors.instagram import InstagramConnector
from app.connectors.base import NormalizedSocialComment
from app.core.social_pipeline import ingest_social_comments
from app.models.moderation import ModerationRecord
from sqlalchemy import select


@pytest.fixture(autouse=True)
async def init_tables():
    await create_tables()


def test_youtube_video_id_extractor():
    """Verifies YouTube video ID extraction across various URL formats."""
    # Standard watch URL
    assert YouTubeConnector.extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    # Short URL
    assert YouTubeConnector.extract_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    # Shorts URL
    assert YouTubeConnector.extract_video_id("https://www.youtube.com/shorts/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    # Live URL
    assert YouTubeConnector.extract_video_id("https://www.youtube.com/live/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    # Embed URL
    assert YouTubeConnector.extract_video_id("https://www.youtube.com/embed/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    # Bare ID
    assert YouTubeConnector.extract_video_id("dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    # Extra query parameters
    assert YouTubeConnector.extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s") == "dQw4w9WgXcQ"
    assert YouTubeConnector.extract_video_id("https://youtu.be/dQw4w9WgXcQ?si=abcdef123456") == "dQw4w9WgXcQ"
    # Invalid URL
    assert YouTubeConnector.extract_video_id("https://example.com/not_a_video") is None
    assert YouTubeConnector.extract_video_id("") is None


def test_instagram_media_id_extractor():
    """Verifies Instagram post, reel, and media ID extraction across various URL formats."""
    # Post URL
    assert InstagramConnector.extract_media_id("https://www.instagram.com/p/C1xYz_aB9/") == "C1xYz_aB9"
    assert InstagramConnector.extract_media_id("https://instagram.com/p/C1xYz_aB9") == "C1xYz_aB9"
    # Reel URL
    assert InstagramConnector.extract_media_id("https://www.instagram.com/reel/C1xYz_aB9/") == "C1xYz_aB9"
    # TV URL
    assert InstagramConnector.extract_media_id("https://www.instagram.com/tv/C1xYz_aB9") == "C1xYz_aB9"
    # Share URL with tracking parameters
    assert InstagramConnector.extract_media_id("https://www.instagram.com/share/p/C1xYz_aB9/?utm_source=ig_web_copy_link") == "C1xYz_aB9"
    # Bare numeric media ID
    assert InstagramConnector.extract_media_id("17989355321012345") == "17989355321012345"
    # Bare alphanumeric shortcode
    assert InstagramConnector.extract_media_id("C1xYz_aB9") == "C1xYz_aB9"
    # Invalid URL
    assert InstagramConnector.extract_media_id("https://example.com/not_instagram") is None
    assert InstagramConnector.extract_media_id("") is None


@pytest.mark.asyncio
async def test_connectors_unconfigured_diagnostic_status():
    """Verifies that connectors report clean diagnostic messages when unconfigured."""
    yt = YouTubeConnector()
    yt.set_runtime_credential(None)
    with patch("app.core.config.settings.YOUTUBE_API_KEY", ""):
        status_yt = await yt.check_connection()
        assert status_yt.platform == "youtube"
        assert status_yt.status == "unconfigured"
        assert "not configured" in status_yt.message.lower()

    ig_conn = InstagramConnector()
    ig_conn.set_runtime_credential(None)
    with patch("app.core.config.settings.INSTAGRAM_ACCESS_TOKEN", ""):
        status_ig = await ig_conn.check_connection()
        assert status_ig.platform == "instagram"
        assert status_ig.status == "unconfigured"
        assert "not configured" in status_ig.message.lower()


@pytest.mark.asyncio
async def test_social_fetch_endpoints_missing_credentials():
    """Verifies that fetch endpoints provide actionable diagnostic errors when server credentials are empty."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.core.config.settings.YOUTUBE_API_KEY", ""):
            yt_resp = await client.post(
                "/api/social/youtube/fetch",
                json={"video_input": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "max_comments": 20}
            )
            assert yt_resp.status_code == 400
            assert "YouTube API Key is not configured on the server" in yt_resp.json()["detail"]

        with patch("app.core.config.settings.INSTAGRAM_ACCESS_TOKEN", ""):
            ig_resp = await client.post(
                "/api/social/instagram/fetch",
                json={"media_input": "https://www.instagram.com/p/C1xYz_aB9/", "max_comments": 20}
            )
            assert ig_resp.status_code == 400
            assert "Instagram Access Token is not configured on the server" in ig_resp.json()["detail"]


@pytest.mark.asyncio
async def test_twitter_endpoints_completely_removed():
    """Verifies that Twitter/X endpoints have been completely replaced and return 404."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # POST /api/social/x/fetch must return 404 Not Found
        x_resp = await client.post(
            "/api/social/x/fetch",
            json={"query": "https://x.com/OpenAI/status/1880000000000000000", "max_posts": 20}
        )
        assert x_resp.status_code == 404


@pytest.mark.asyncio
async def test_social_pipeline_deduplication_and_local_moderation():
    """
    Verifies that the social ingestion pipeline:
    1. Executes local offline scikit-learn moderation.
    2. Deduplicates comments by platform + source_id.
    3. Persists records to ModerationRecord and creates SocialSyncLog.
    """
    import uuid
    uid1 = f"ig_dedup_{uuid.uuid4().hex[:8]}"
    uid2 = f"ig_dedup_{uuid.uuid4().hex[:8]}"
    async with AsyncSessionLocal() as session:
        mock_comments = [
            NormalizedSocialComment(
                platform="instagram",
                comment_id=uid1,
                text="This is an awesome presentation on cybersecurity!",
                author_name="GoodCitizen",
                source_url=f"https://www.instagram.com/p/test123/",
            ),
            NormalizedSocialComment(
                platform="instagram",
                comment_id=uid2,
                text="You are an idiot and you should die",
                author_name="ToxicUser",
                source_url=f"https://www.instagram.com/p/test123/",
            ),
        ]

        # First ingestion
        res1 = await ingest_social_comments(
            db=session,
            comments=mock_comments,
            platform="instagram",
            target_input="test123",
            user_id="test-eval-user"
        )
        assert res1["newly_ingested"] == 2
        assert res1["duplicate_count"] == 0
        assert res1["total_fetched"] == 2
        assert len(res1["records"]) == 2

        # Second ingestion of the same comments (deduplication check)
        res2 = await ingest_social_comments(
            db=session,
            comments=mock_comments,
            platform="instagram",
            target_input="test123",
            user_id="test-eval-user"
        )
        assert res2["newly_ingested"] == 0
        assert res2["duplicate_count"] == 2

        # Verify DB records
        q = select(ModerationRecord).where(
            ModerationRecord.platform == "instagram",
            ModerationRecord.source_id.in_([uid1, uid2])
        )
        db_res = await session.execute(q)
        records = db_res.scalars().all()
        assert len(records) == 2
        assert any(r.decision == "no_action" for r in records)


@pytest.mark.asyncio
async def test_social_api_endpoints():
    """Tests the /api/social router endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # GET /api/social/connectors
        resp = await client.get("/api/social/connectors")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        platforms = [item["platform"] for item in data]
        assert "youtube" in platforms
        assert "instagram" in platforms
        assert "x" not in platforms

        # GET /api/social/stats
        stats_resp = await client.get("/api/social/stats")
        assert stats_resp.status_code == 200
        stats_data = stats_resp.json()
        assert "platforms" in stats_data
        assert "youtube" in stats_data["platforms"]
        assert "instagram" in stats_data["platforms"]

        # GET /api/social/sync-history
        hist_resp = await client.get("/api/social/sync-history")
        assert hist_resp.status_code == 200
        assert isinstance(hist_resp.json(), list)


@pytest.mark.asyncio
async def test_youtube_comment_severity_classification_and_policy():
    """
    Verifies operational severity band policy on representative social comments:
    - Non-toxic comments -> low severity, no_action decision.
    - Moderate toxicity -> medium severity, flag_for_review.
    - Elevated toxicity / severe threat -> high severity, flag_for_review.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Benign comments
        benign_comments = [
            "Great recipe, absolutely loved the detailed steps!",
            "Thank you for sharing this informative video.",
            "Mari aakali oka level lo avutundi",  # Telugu Romanized cooking comment
            "Awesome work, really enjoyed this video!",
        ]
        for comment in benign_comments:
            resp = await client.post("/api/analyze", json={"text": comment})
            assert resp.status_code == 200, f"Failed for {comment}"
            data = resp.json()
            assert data["severity"] in ["low", "uncertain"], f"Expected low/uncertain severity for '{comment}', got {data['severity']}"
            assert data["decision"] in ["no_action", "human_review"], f"Expected non-punitive decision for '{comment}', got {data['decision']}"
            labels = {l["label"]: l["score"] for l in data["labels"]}
            assert labels["hate_speech"] < 0.40, f"False hate speech label for '{comment}'"
            assert labels["harassment"] < 0.40, f"False harassment label for '{comment}'"

        # 1b. Colloquial banter
        resp_banter = await client.post("/api/analyze", json={"text": "Nice troll"})
        assert resp_banter.status_code == 200
        banter_data = resp_banter.json()
        banter_labels = {l["label"]: l["score"] for l in banter_data["labels"]}
        assert banter_labels["hate_speech"] < 0.40, "General toxicity must not force hate speech"
        assert banter_labels["harassment"] < 0.40, "General toxicity must not force harassment"

        # 2. Harmful comments (insult / harassment)
        harmful_comments = [
            "Shut up you idiot",
            "You are completely useless and pathetic person",
        ]
        for comment in harmful_comments:
            resp = await client.post("/api/analyze", json={"text": comment})
            assert resp.status_code == 200
            data = resp.json()
            assert data["severity"] in ["medium", "high"]
            assert data["decision"] == "flag_for_review"

        # 3. Severe death threat pattern
        threat_resp = await client.post("/api/analyze", json={"text": "You deserve to die and I will ruin you."})
        assert threat_resp.status_code == 200
        threat_data = threat_resp.json()
        assert threat_data["severity"] == "high"
        assert threat_data["decision"] == "flag_for_review"


@pytest.mark.asyncio
async def test_platform_distribution_donut_refresh_after_ingestion():
    """
    Verifies that Platform Distribution values:
    1. Update immediately after newly ingested comments.
    2. Remain unchanged after duplicate-only fetches.
    3. Remain unchanged after failed fetches.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Fetch initial platform distribution
        init_resp = await client.get("/api/dashboard/distributions?timeframe=7d")
        assert init_resp.status_code == 200
        init_dist = init_resp.json().get("platform_distribution", {})
        init_ig_count = init_dist.get("instagram", 0)

        # 2. Ingest 2 new unique mock Instagram comments
        import uuid
        uid1 = f"ig_donut_{uuid.uuid4().hex[:8]}"
        uid2 = f"ig_donut_{uuid.uuid4().hex[:8]}"
        async with AsyncSessionLocal() as session:
            mock_comments = [
                NormalizedSocialComment(
                    platform="instagram",
                    comment_id=uid1,
                    text="First test comment for platform distribution refresh",
                    author_name="DonutUser1",
                    source_url=f"https://www.instagram.com/p/donut1/",
                ),
                NormalizedSocialComment(
                    platform="instagram",
                    comment_id=uid2,
                    text="Second test comment for platform distribution refresh",
                    author_name="DonutUser2",
                    source_url=f"https://www.instagram.com/p/donut1/",
                ),
            ]
            ingest_res = await ingest_social_comments(
                db=session,
                comments=mock_comments,
                platform="instagram",
                target_input="donut1",
                user_id=None
            )
            assert ingest_res["newly_ingested"] == 2

        # 3. Verify platform distribution reflects the +2 count in 7-day query
        after_resp = await client.get("/api/dashboard/distributions?timeframe=7d")
        assert after_resp.status_code == 200
        after_dist = after_resp.json().get("platform_distribution", {})
        after_ig_count = after_dist.get("instagram", 0)
        assert after_ig_count == init_ig_count + 2, f"Expected {init_ig_count + 2}, got {after_ig_count}"

        # 4. Ingest DUPLICATES of the same comments (duplicate-only fetch)
        async with AsyncSessionLocal() as session:
            dup_res = await ingest_social_comments(
                db=session,
                comments=mock_comments,
                platform="instagram",
                target_input="donut1",
                user_id=None
            )
            assert dup_res["newly_ingested"] == 0
            assert dup_res["duplicate_count"] == 2

        # 5. Verify distribution has NOT changed after duplicate fetch
        dup_dist_resp = await client.get("/api/dashboard/distributions?timeframe=7d")
        assert dup_dist_resp.status_code == 200
        dup_dist = dup_dist_resp.json().get("platform_distribution", {})
        assert dup_dist.get("instagram", 0) == after_ig_count

        # 6. Verify distribution has NOT changed after a failed API fetch
        failed_resp = await client.post(
            "/api/social/youtube/fetch",
            json={"video_input": "invalid_url_with_no_id", "max_comments": 10}
        )
        assert failed_resp.status_code in [400, 422]
        fail_dist_resp = await client.get("/api/dashboard/distributions?timeframe=7d")
        assert fail_dist_resp.status_code == 200
        fail_dist = fail_dist_resp.json().get("platform_distribution", {})
        assert fail_dist.get("instagram", 0) == after_ig_count


@pytest.mark.asyncio
async def test_instagram_connector_diagnostics_and_error_handling():
    """
    Verifies that Instagram connector handles:
    - HTTP 401 Unauthorized (expired token).
    - HTTP 403 Forbidden (missing permissions).
    - HTTP 429 Rate limit.
    """
    connector = InstagramConnector()
    connector.set_runtime_credential("dummy_token")

    # 1. HTTP 401 Unauthorized
    mock_resp_401 = MagicMock(spec=httpx.Response)
    mock_resp_401.status_code = 401
    mock_resp_401.text = '{"error":{"message":"Invalid OAuth access token."}}'
    mock_resp_401.json.return_value = {"error": {"message": "Invalid OAuth access token."}}

    with patch.object(connector, "_request_with_retry", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp_401
        status = await connector.check_connection()
        assert status.status == "error"
        assert "401" in status.message

    # 2. HTTP 403 Permission Denied
    mock_resp_403 = MagicMock(spec=httpx.Response)
    mock_resp_403.status_code = 403
    mock_resp_403.text = '{"error":{"message":"(#10) Application does not have permission for this action"}}'
    mock_resp_403.json.return_value = {"error": {"message": "(#10) Application does not have permission for this action"}}

    with patch.object(connector, "_request_with_retry", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp_403
        status = await connector.check_connection()
        assert status.status == "error"
        assert "403" in status.message
        assert "instagram_basic" in status.message

    # 3. HTTP 429 Rate Limit
    mock_resp_429 = MagicMock(spec=httpx.Response)
    mock_resp_429.status_code = 429
    mock_resp_429.text = '{"error":{"message":"User request limit reached"}}'
    mock_resp_429.json.return_value = {"error": {"message": "User request limit reached"}}

    with patch.object(connector, "_request_with_retry", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp_429
        status = await connector.check_connection()
        assert status.status == "rate_limited"
        assert "429" in status.message
