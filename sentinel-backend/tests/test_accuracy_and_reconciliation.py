"""Comprehensive test suite for Detection-to-Database Accuracy and Dashboard Mathematical Reconciliation."""
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from app.models.moderation import ModerationRecord


async def register_and_login(client: AsyncClient, prefix: str):
    email = f"{prefix}_{uuid.uuid4().hex[:6]}@cybertech.ai"
    pwd = "SecurePassword123!"
    reg_resp = await client.post(
        "/api/auth/register",
        json={"email": email, "name": f"User {prefix}", "password": pwd, "role": "moderator"}
    )
    assert reg_resp.status_code in (200, 201), f"Register failed: {reg_resp.text}"
    token = reg_resp.json()["access_token"]
    user_data = reg_resp.json()["user"]
    headers = {"Authorization": f"Bearer {token}"}
    return token, user_data, headers


@pytest.mark.asyncio
async def test_detection_to_database_persistence_and_accuracy():
    """Verify that model detection output is accurately persisted to DB across all sources."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, user_a, headers_a = await register_and_login(client, "audit_user")

        # 1. Manual Text Analysis
        test_comment = "You are an absolute idiot and complete waste of time."
        resp = await client.post(
            "/api/analyze",
            json={"text": test_comment, "platform": "Manual Triage", "language_hint": "english"},
            headers=headers_a
        )
        assert resp.status_code == 200
        data = resp.json()
        rec_id = data["id"]
        assert data["original_text"] == test_comment
        assert data["severity"] in ("high", "medium")
        assert data["decision"] in ("flag_for_review", "escalate")
        assert "toxicity_prediction" in data
        assert data["toxicity_prediction"]["is_toxic"] is True

        # Verify DB record matches returned response exactly
        detail_resp = await client.get(f"/api/moderation/{rec_id}", headers=headers_a)
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        assert detail["id"] == rec_id
        assert detail["original_text"] == test_comment
        assert detail["severity"] == data["severity"]
        assert detail["decision"] == data["decision"]
        assert detail["platform"] == "Manual Triage"
        assert abs(detail["harassment_score"] - next(l["score"] for l in data["labels"] if l["label"] == "harassment")) < 1e-4

        # 2. Compare Context Persistence
        compare_resp = await client.post(
            "/api/analyze/compare-context",
            json={
                "text": "I hate you so much",
                "context_before": "Why did you steal my wallet?",
                "context_after": None,
                "language_hint": "english"
            },
            headers=headers_a
        )
        assert compare_resp.status_code == 200
        cmp_data = compare_resp.json()
        ctx_id = cmp_data["with_context"]["id"]

        # Verify compare-context record was persisted
        ctx_detail = await client.get(f"/api/moderation/{ctx_id}", headers=headers_a)
        assert ctx_detail.status_code == 200
        assert ctx_detail.json()["platform"] == "Compare Context"
        assert ctx_detail.json()["original_text"] == "I hate you so much"

        # 3. Compare Texts Persistence
        cmp_texts_resp = await client.post(
            "/api/analyze/compare-texts",
            json={
                "text1": "I appreciate your valuable help and support.",
                "text2": "You are a disgusting idiot.",
                "language_hint1": "english",
                "language_hint2": "english",
                "platform": "Compare Context"
            },
            headers=headers_a
        )
        assert cmp_texts_resp.status_code == 200
        t_data = cmp_texts_resp.json()
        id1 = t_data["text1_analysis"]["id"]
        id2 = t_data["text2_analysis"]["id"]

        d1 = await client.get(f"/api/moderation/{id1}", headers=headers_a)
        d2 = await client.get(f"/api/moderation/{id2}", headers=headers_a)
        assert d1.status_code == 200
        assert d2.status_code == 200
        assert d1.json()["severity"] == "low"
        assert d2.json()["severity"] in ("high", "medium")


@pytest.mark.asyncio
async def test_dashboard_kpis_and_mathematical_reconciliation():
    """Verify Dashboard KPIs, charts, and distributions reconcile mathematically."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, _, headers = await register_and_login(client, "recon_user")

        # Ingest a balanced set of comments under this account
        test_inputs = [
            ("Thank you for sharing this informative guide.", "english", "low", "no_action", "youtube"),
            ("Great video, learned a lot today!", "english", "low", "no_action", "youtube"),
            ("You are a pathetic idiot and should be banned.", "english", "high", "flag_for_review", "youtube"),
            ("Shut up stupid fool.", "english", "medium", "flag_for_review", "instagram"),
            ("ఇది చాలా మంచి సమాచారం, ధన్యవాదాలు.", "telugu", "low", "no_action", "manual"),
            ("నువ్వు ఒక పనికిమాలిన వెధవవి", "telugu", "high", "flag_for_review", "manual"),
            ("यह बहुत अच्छा और उपयोगी वीडियो है।", "hindi", "low", "no_action", "csv_upload"),
            ("तू बहुत ही घटिया और बदतमीज इंसान है", "hindi", "high", "flag_for_review", "csv_upload"),
        ]

        for text, lang, _, _, plat in test_inputs:
            res = await client.post(
                "/api/analyze",
                json={"text": text, "language_hint": lang, "platform": plat},
                headers=headers
            )
            assert res.status_code == 200

        # Fetch Dashboard Summary
        sum_resp = await client.get("/api/dashboard/summary?timeframe=all", headers=headers)
        assert sum_resp.status_code == 200
        s = sum_resp.json()

        total = s["total_analyzed"]
        flagged = s["flagged_comments"]
        non_flagged = s["non_flagged_comments"]

        assert total == 8, f"Expected 8 total records, got {total}"
        assert flagged + non_flagged == total, f"Sum reconciliation failed: {flagged} + {non_flagged} != {total}"
        assert s["violation_rate"] == round((flagged / total) * 100.0, 2)
        assert s["clean_rate"] == round((non_flagged / total) * 100.0, 2)

        # Fetch Distributions
        dist_resp = await client.get("/api/dashboard/distributions?timeframe=all", headers=headers)
        assert dist_resp.status_code == 200
        d = dist_resp.json()

        sev_sum = sum(d["severity_distribution"].values())
        lang_sum = sum(d["language_distribution"].values())
        plat_sum = sum(d["platform_distribution"].values())
        cat_sum = sum(d["category_distribution"].values())

        assert sev_sum == total, f"Severity sum {sev_sum} != {total}"
        assert lang_sum == total, f"Language sum {lang_sum} != {total}"
        assert plat_sum == total, f"Platform sum {plat_sum} != {total}"
        assert cat_sum == total, f"Category sum {cat_sum} != {total}"

        # Fetch Timeline and verify per-day reconciliation
        time_resp = await client.get("/api/dashboard/timeline?timeframe=all&days=7", headers=headers)
        assert time_resp.status_code == 200
        timeline = time_resp.json()

        timeline_total = sum(day["total"] for day in timeline)
        timeline_flagged = sum(day["flagged"] for day in timeline)
        timeline_approved = sum(day["approved"] for day in timeline)

        for day in timeline:
            assert day["flagged"] + day["approved"] == day["total"], (
                f"Day {day['date']} failed: {day['flagged']} + {day['approved']} != {day['total']}"
            )

        assert timeline_total == total, f"Timeline total {timeline_total} != summary total {total}"
        assert timeline_flagged == flagged, f"Timeline flagged {timeline_flagged} != summary flagged {flagged}"
        assert timeline_approved == non_flagged, f"Timeline approved {timeline_approved} != summary non_flagged {non_flagged}"


@pytest.mark.asyncio
async def test_human_review_workflow_and_dashboard_reconciliation():
    """Verify human review decisions reconcile across Command Center and Dashboard KPIs."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, _, headers = await register_and_login(client, "mod_reviewer")

        # Analyze a harmful comment (starts as flagged and pending review)
        post_resp = await client.post(
            "/api/analyze",
            json={"text": "You are a terrible person and an absolute loser.", "language_hint": "english"},
            headers=headers
        )
        assert post_resp.status_code == 200
        rec_id = post_resp.json()["id"]

        sum_before = (await client.get("/api/dashboard/summary?timeframe=all", headers=headers)).json()
        assert sum_before["pending_review"] >= 1

        # Moderator reviews and overrides to approve as civil
        dec_resp = await client.post(
            f"/api/moderation/{rec_id}/decision",
            json={
                "action": "approve",
                "reviewer_notes": "Adjudicated as acceptable hyperbole; approved.",
                "reviewer_id": "test_mod_1",
                "reviewer_name": "Senior Moderator"
            },
            headers=headers
        )
        assert dec_resp.status_code == 200
        assert dec_resp.json()["new_status"] == "reviewed"

        # Verify Dashboard KPIs update to reflect human moderation
        sum_after = (await client.get("/api/dashboard/summary?timeframe=all", headers=headers)).json()
        assert sum_after["pending_review"] == sum_before["pending_review"] - 1
        assert sum_after["non_flagged_comments"] == sum_before["non_flagged_comments"] + 1
        assert sum_after["total_analyzed"] == sum_before["total_analyzed"]


@pytest.mark.asyncio
async def test_two_account_complete_data_isolation_and_reconciliation():
    """Verify complete data isolation between two independent accounts."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, _, headers_a = await register_and_login(client, "tenant_alpha")
        _, _, headers_b = await register_and_login(client, "tenant_beta")

        # Tenant Alpha submits 3 comments
        for i in range(3):
            await client.post(
                "/api/analyze",
                json={"text": f"Alpha message {i}: constructive discussion.", "language_hint": "en"},
                headers=headers_a
            )

        # Tenant Beta submits 2 comments (1 abusive, 1 civil)
        await client.post(
            "/api/analyze",
            json={"text": "Beta message: I disagree respectfully.", "language_hint": "en"},
            headers=headers_b
        )
        await client.post(
            "/api/analyze",
            json={"text": "Beta message: You idiot, delete your post.", "language_hint": "en"},
            headers=headers_b
        )

        sum_a = (await client.get("/api/dashboard/summary?timeframe=all", headers=headers_a)).json()
        sum_b = (await client.get("/api/dashboard/summary?timeframe=all", headers=headers_b)).json()

        assert sum_a["total_analyzed"] == 3
        assert sum_b["total_analyzed"] == 2

        # Verify Tenant A cannot access Tenant B's moderation list
        list_a = (await client.get("/api/moderation", headers=headers_a)).json()
        list_b = (await client.get("/api/moderation", headers=headers_b)).json()

        items_a = [item["id"] for item in list_a["items"]]
        items_b = [item["id"] for item in list_b["items"]]

        assert len(set(items_a).intersection(set(items_b))) == 0
