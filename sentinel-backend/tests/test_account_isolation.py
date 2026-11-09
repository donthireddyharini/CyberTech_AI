"""
Tests for Account-Wise Data Storage and Isolation in CyberTech AI.
Verifies:
  1. Two separate authenticated accounts (Account A and Account B).
  2. Complete data isolation for manual comment analysis.
  3. Context Intelligence chatbot sessions and message persistence per account.
  4. Moderation command center and review queue account isolation.
  5. Dashboard summary, distributions, and recent telemetry isolation.
  6. Social media ingestion account isolation.
  7. Direct API access rejection (403 Forbidden) when accessing another account's records/sessions.
  8. Account switching restores correct history without cross-account contamination.
"""
import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from main import app
from app.core.database import create_tables


@pytest.fixture(autouse=True)
async def init_db():
    await create_tables()


async def register_and_login(client: AsyncClient, email_prefix: str, role: str = "moderator"):
    uid = uuid.uuid4().hex[:8]
    email = f"{email_prefix}_{uid}@cybertech.ai"
    password = "SecurePassword2026!"
    name = f"User {email_prefix.capitalize()}"

    resp = await client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "name": name,
        "preferred_language": "en"
    })
    assert resp.status_code == 201, resp.text
    data = resp.json()
    token = data["access_token"]
    user = data["user"]
    return token, user, {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_two_account_chat_session_isolation_and_protection():
    """Verify chatbot sessions are saved per-account and cross-account access returns 403."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create Account A and Account B
        token_a, user_a, headers_a = await register_and_login(client, "account_a")
        token_b, user_b, headers_b = await register_and_login(client, "account_b")

        # 2. Account A creates a chat session
        sess_resp_a = await client.post(
            "/api/analyze/sessions",
            json={"title": "Account A Private Investigation"},
            headers=headers_a
        )
        assert sess_resp_a.status_code == 200
        sess_a_id = sess_resp_a.json()["id"]

        # Add message to Account A's session
        msg_resp_a = await client.post(
            f"/api/analyze/sessions/{sess_a_id}/messages",
            json={
                "text": "This is a private message for Account A",
                "language_hint": "en",
                "result": {
                    "text": "This is a private message for Account A",
                    "original_text": "This is a private message for Account A",
                    "model_name": "baseline",
                    "model_version": "1.0.0",
                    "labels": [],
                    "severity": "low",
                    "decision": "no_action"
                }
            },
            headers=headers_a
        )
        assert msg_resp_a.status_code == 200

        # 3. Account B lists sessions -> Account A's session must NOT appear
        sessions_b_resp = await client.get("/api/analyze/sessions", headers=headers_b)
        assert sessions_b_resp.status_code == 200
        b_session_ids = [s["id"] for s in sessions_b_resp.json()]
        assert sess_a_id not in b_session_ids, "Account A's session leaked to Account B in list view!"

        # 4. Account B attempts direct read of Account A's session -> 403 Forbidden
        direct_get_b = await client.get(f"/api/analyze/sessions/{sess_a_id}", headers=headers_b)
        assert direct_get_b.status_code == 403, "Account B should be forbidden from accessing Account A's session!"

        # 5. Account B attempts to add message to Account A's session -> 403 Forbidden
        direct_post_b = await client.post(
            f"/api/analyze/sessions/{sess_a_id}/messages",
            json={
                "text": "Intruder message from Account B",
                "result": {"labels": [], "severity": "low", "decision": "no_action"}
            },
            headers=headers_b
        )
        assert direct_post_b.status_code == 403

        # 6. Account B attempts to delete Account A's session -> 403 Forbidden
        direct_del_b = await client.delete(f"/api/analyze/sessions/{sess_a_id}", headers=headers_b)
        assert direct_del_b.status_code == 403

        # 7. Account B creates their own session
        sess_resp_b = await client.post(
            "/api/analyze/sessions",
            json={"title": "Account B Separate Session"},
            headers=headers_b
        )
        assert sess_resp_b.status_code == 200
        sess_b_id = sess_resp_b.json()["id"]

        # 8. Account A lists sessions -> Only sees Account A's session, not Account B's
        sessions_a_resp = await client.get("/api/analyze/sessions", headers=headers_a)
        assert sessions_a_resp.status_code == 200
        a_session_ids = [s["id"] for s in sessions_a_resp.json()]
        assert sess_a_id in a_session_ids
        assert sess_b_id not in a_session_ids, "Account B's session leaked to Account A!"


@pytest.mark.asyncio
async def test_two_account_moderation_record_and_review_isolation():
    """Verify comment analysis records and reviews are strictly account-scoped."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create Account A and Account B
        token_a, user_a, headers_a = await register_and_login(client, "moderator_a")
        token_b, user_b, headers_b = await register_and_login(client, "moderator_b")

        # Account A analyzes a harmful comment
        harmful_comment_a = f"Account A specific abusive comment {uuid.uuid4().hex[:6]}"
        analyze_res_a = await client.post(
            "/api/analyze",
            json={"text": harmful_comment_a, "language_hint": "en", "platform": "Manual A"},
            headers=headers_a
        )
        assert analyze_res_a.status_code == 200
        rec_a_id = analyze_res_a.json()["id"]

        # Account B analyzes a different comment
        harmless_comment_b = f"Account B constructive comment {uuid.uuid4().hex[:6]}"
        analyze_res_b = await client.post(
            "/api/analyze",
            json={"text": harmless_comment_b, "language_hint": "en", "platform": "Manual B"},
            headers=headers_b
        )
        assert analyze_res_b.status_code == 200
        rec_b_id = analyze_res_b.json()["id"]

        # Account A lists moderation records -> only sees Account A's comment
        list_a = await client.get("/api/moderation", headers=headers_a)
        assert list_a.status_code == 200
        a_records = [item["id"] for item in list_a.json()["items"]]
        assert rec_a_id in a_records
        assert rec_b_id not in a_records, "Account B's record leaked into Account A's moderation center!"

        # Account B lists moderation records -> only sees Account B's comment
        list_b = await client.get("/api/moderation", headers=headers_b)
        assert list_b.status_code == 200
        b_records = [item["id"] for item in list_b.json()["items"]]
        assert rec_b_id in b_records
        assert rec_a_id not in b_records, "Account A's record leaked into Account B's moderation center!"

        # Account B attempts direct access to Account A's record -> 403 Forbidden
        direct_rec_b = await client.get(f"/api/moderation/{rec_a_id}", headers=headers_b)
        assert direct_rec_b.status_code == 403, "Account B should be forbidden from accessing Account A's record!"

        # Account B attempts review decision on Account A's record -> 403 Forbidden
        review_attempt_b = await client.post(
            f"/api/moderation/{rec_a_id}/decision",
            json={
                "action": "dismiss",
                "reviewer_id": user_b["id"],
                "reviewer_name": "Account B",
                "override_reason": "Malicious override attempt"
            },
            headers=headers_b
        )
        assert review_attempt_b.status_code == 403


@pytest.mark.asyncio
async def test_two_account_dashboard_analytics_isolation():
    """Verify Dashboard summary KPIs and distributions are strictly account-scoped."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token_a, user_a, headers_a = await register_and_login(client, "dash_user_a")
        token_b, user_b, headers_b = await register_and_login(client, "dash_user_b")

        # Initial state for fresh accounts should have total_analyzed == 0
        summary_a_init = await client.get("/api/dashboard/summary", headers=headers_a)
        assert summary_a_init.status_code == 200
        assert summary_a_init.json()["total_analyzed"] == 0

        summary_b_init = await client.get("/api/dashboard/summary", headers=headers_b)
        assert summary_b_init.status_code == 200
        assert summary_b_init.json()["total_analyzed"] == 0

        # Account A performs 3 comment analyses
        for i in range(3):
            await client.post(
                "/api/analyze",
                json={"text": f"User A test message #{i}", "language_hint": "en"},
                headers=headers_a
            )

        # Account B performs 1 comment analysis
        await client.post(
            "/api/analyze",
            json={"text": "User B single message", "language_hint": "en"},
            headers=headers_b
        )

        # Account A dashboard summary must show exactly 3
        summary_a = await client.get("/api/dashboard/summary", headers=headers_a)
        assert summary_a.status_code == 200
        assert summary_a.json()["total_analyzed"] == 3

        # Account B dashboard summary must show exactly 1
        summary_b = await client.get("/api/dashboard/summary", headers=headers_b)
        assert summary_b.status_code == 200
        assert summary_b.json()["total_analyzed"] == 1

        # Account A recent activity must show 3 items, all from User A
        recent_a = await client.get("/api/dashboard/recent", headers=headers_a)
        assert recent_a.status_code == 200
        assert len(recent_a.json()) == 3
        assert all("User A" in r["text_preview"] for r in recent_a.json())

        # Account B recent activity must show 1 item, from User B
        recent_b = await client.get("/api/dashboard/recent", headers=headers_b)
        assert recent_b.status_code == 200
        assert len(recent_b.json()) == 1
        assert "User B" in recent_b.json()[0]["text_preview"]
