import pytest
import httpx
from httpx import AsyncClient, ASGITransport
from main import app
from app.connectors.youtube import YouTubeConnector
from app.connectors.instagram import InstagramConnector


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_social_fetch_validation_custom_count_limits(client):
    """Test custom count validation for YouTube and Instagram ingestion."""
    # 1. Negative or zero max_comments rejected
    resp_zero = await client.post("/api/social/youtube/fetch", json={
        "video_input": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "max_comments": 0
    })
    assert resp_zero.status_code == 422

    # 2. Excessive max_comments (> 500) rejected
    resp_excess = await client.post("/api/social/youtube/fetch", json={
        "video_input": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "max_comments": 501
    })
    assert resp_excess.status_code == 422

    # 3. Instagram excessive count (> 500) rejected
    resp_ig_excess = await client.post("/api/social/instagram/fetch", json={
        "media_input": "https://www.instagram.com/p/C_abc123/",
        "max_comments": 1000
    })
    assert resp_ig_excess.status_code == 422


@pytest.mark.asyncio
async def test_youtube_connector_custom_count_and_pagination(monkeypatch):
    """Test YouTube connector pagination and strict adherence to custom comment count limit."""
    yt = YouTubeConnector()
    yt._runtime_credential = "test_yt_key_123"

    call_count = 0

    async def mock_request_with_retry(self, client, method, url, params=None, **kwargs):
        nonlocal call_count
        call_count += 1
        page = params.get("pageToken")
        if not page:
            items = [
                {
                    "id": f"comment_{i}",
                    "snippet": {
                        "topLevelComment": {
                            "id": f"comment_{i}",
                            "snippet": {
                                "textDisplay": f"Test top comment {i}",
                                "authorDisplayName": f"User {i}",
                                "publishedAt": "2026-03-01T12:00:00Z"
                            }
                        }
                    }
                }
                for i in range(1, 11)
            ]
            return httpx.Response(200, json={"items": items, "nextPageToken": "token_page_2"}, request=httpx.Request("GET", url))
        else:
            items = [
                {
                    "id": f"comment_{i}",
                    "snippet": {
                        "topLevelComment": {
                            "id": f"comment_{i}",
                            "snippet": {
                                "textDisplay": f"Test top comment {i}",
                                "authorDisplayName": f"User {i}",
                                "publishedAt": "2026-03-01T12:00:00Z"
                            }
                        }
                    }
                }
                for i in range(11, 21)
            ]
            return httpx.Response(200, json={"items": items}, request=httpx.Request("GET", url))

    monkeypatch.setattr(YouTubeConnector, "_request_with_retry", mock_request_with_retry)

    # Request custom count of 15 comments
    comments, stats = await yt.fetch_comments(
        target_input="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        max_comments=15,
        include_replies=False
    )

    # Must fetch exactly 15 comments (not 10, not 20)
    assert len(comments) == 15
    assert stats["requested_count"] == 15
    assert stats["total_fetched"] == 15
    assert stats["pages_retrieved"] == 2
    assert call_count == 2


@pytest.mark.asyncio
async def test_instagram_connector_custom_count_pagination_and_error(monkeypatch):
    """Test Instagram connector pagination up to custom count and permission error handling."""
    ig = InstagramConnector()
    ig._runtime_credential = "test_ig_token_abc"

    call_count = 0
    async def mock_ig_request(self, client, method, url, params=None, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            data = [
                {"id": f"ig_c_{i}", "text": f"Nice post {i}", "username": f"user_{i}", "timestamp": "2026-03-01T10:00:00Z"}
                for i in range(1, 21)
            ]
            return httpx.Response(200, json={
                "data": data,
                "paging": {"next": "https://graph.facebook.com/v20.0/media_1/comments?after=cursor_2"}
            }, request=httpx.Request("GET", url))
        else:
            data = [
                {"id": f"ig_c_{i}", "text": f"Nice post {i}", "username": f"user_{i}", "timestamp": "2026-03-01T10:00:00Z"}
                for i in range(21, 41)
            ]
            return httpx.Response(200, json={"data": data}, request=httpx.Request("GET", url))

    monkeypatch.setattr(InstagramConnector, "_request_with_retry", mock_ig_request)

    # Request custom count of 25 comments
    comments, meta = await ig.fetch_comments(
        media_input="https://www.instagram.com/p/C_abc123/",
        max_comments=25,
        include_replies=False
    )
    assert len(comments) == 25
    assert meta["requested_count"] == 25
    assert meta["total_fetched"] == 25

    # Test 403 Forbidden with Meta official permission restriction message
    async def mock_forbidden(self, client, method, url, **kwargs):
        return httpx.Response(403, json={"error": {"message": "(#10) Application does not have permission for this action"}}, request=httpx.Request("GET", url))

    monkeypatch.setattr(InstagramConnector, "_request_with_retry", mock_forbidden)
    with pytest.raises(PermissionError) as exc_info:
        await ig.fetch_comments(media_input="17989355321012345", max_comments=10)
    assert "Meta Graph API restricts comment access" in str(exc_info.value)
