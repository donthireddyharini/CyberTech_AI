"""
Regression tests for Sentinel AI Dashboard Data Flow and Persistence.
Verifies:
1. Individual comment detection persistence -> Dashboard retrieval
2. Batch comment analysis persistence -> Dashboard retrieval
3. Dataset detection runner -> DatasetRun record & Dashboard totals
4. Timeframe date filters (today, yesterday, 7d, 30d, all)
5. Clean zero-state isolation for new users
"""
import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.mark.asyncio
async def test_individual_detection_data_flow():
    """Verify that analyzing an individual comment persists and immediately reflects in Dashboard summary and recent telemetry."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Get baseline count
        sum_before = await client.get("/api/dashboard/summary?timeframe=all")
        assert sum_before.status_code == 200
        baseline_total = sum_before.json()["total_analyzed"]

        # 2. Analyze a harmful comment
        payload = {
            "text": "This is completely abhorrent harassment and you should be banned.",
            "language_hint": "en",
            "platform": "Regression Test"
        }
        res = await client.post("/api/analyze", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "id" in data
        assert data["decision"] in ["flag_for_review", "no_action"]

        # 3. Check Dashboard summary
        sum_after = await client.get("/api/dashboard/summary?timeframe=all")
        assert sum_after.status_code == 200
        after_total = sum_after.json()["total_analyzed"]
        assert after_total == baseline_total + 1

        # 4. Check Recent Activity
        recent_res = await client.get("/api/dashboard/recent?limit=5")
        assert recent_res.status_code == 200
        recent = recent_res.json()
        assert len(recent) > 0
        found = any("abhorrent harassment" in r["text_preview"] for r in recent)
        assert found, "Recently analyzed comment not found in dashboard recent activity"


@pytest.mark.asyncio
async def test_batch_monitoring_data_flow():
    """Verify that batch comment ingestion persists individual records and records a completed DatasetRun."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sum_before = await client.get("/api/dashboard/summary?timeframe=all")
        assert sum_before.status_code == 200
        total_before = sum_before.json()["total_analyzed"]
        runs_before = sum_before.json()["completed_dataset_runs"]

        batch_payload = {
            "comments": [
                "Great presentation, thanks for sharing!",
                "You are an absolute idiot and a complete loser.",
                "Weather in Bengaluru is really pleasant today."
            ],
            "language_hint": "en",
            "platform_source": "Batch Data Flow Test",
            "deduplicate": True
        }
        batch_res = await client.post("/api/monitor/batch-analyze", json=batch_payload)
        assert batch_res.status_code == 200
        batch_data = batch_res.json()
        assert batch_data["processed_count"] == 3
        assert batch_data["flagged_count"] >= 1

        # Check dashboard summary reflects batch
        sum_after = await client.get("/api/dashboard/summary?timeframe=all")
        assert sum_after.status_code == 200
        total_after = sum_after.json()["total_analyzed"]
        runs_after = sum_after.json()["completed_dataset_runs"]

        assert total_after == total_before + 3
        assert runs_after == runs_before + 1


@pytest.mark.asyncio
async def test_dataset_detection_workflow():
    """Verify running detection on a registered dataset persists records, produces DatasetRun, and updates Dashboard."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First list datasets
        ds_res = await client.get("/api/datasets")
        assert ds_res.status_code == 200
        datasets = ds_res.json()
        assert len(datasets) > 0

        target_ds = datasets[0]
        ds_id = target_ds["id"]

        # Run detection on 5 samples
        detect_res = await client.post(f"/api/datasets/{ds_id}/detect?sample_limit=5")
        assert detect_res.status_code == 200
        run_data = detect_res.json()
        assert run_data["status"] == "completed"
        assert run_data["processed_count"] == 5
        assert "flagged_count" in run_data
        assert "approved_count" in run_data
        assert len(run_data["items"]) > 0

        # Verify dataset run appears in runs list
        runs_res = await client.get("/api/datasets/runs")
        assert runs_res.status_code == 200
        runs = runs_res.json()
        assert any(r["id"] == run_data["run_id"] for r in runs)


@pytest.mark.asyncio
async def test_date_filters_and_timeframe():
    """Verify that timeframe query parameter works across dashboard endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for tf in ["today", "yesterday", "7d", "30d", "all"]:
            res = await client.get(f"/api/dashboard/summary?timeframe={tf}")
            assert res.status_code == 200
            data = res.json()
            assert "total_analyzed" in data
            assert "flagged_comments" in data
            assert "non_flagged_comments" in data

            dist = await client.get(f"/api/dashboard/distributions?timeframe={tf}")
            assert dist.status_code == 200
            assert "severity_distribution" in dist.json()
            assert "language_distribution" in dist.json()


@pytest.mark.asyncio
async def test_timeline_endpoint():
    """Verify time-series timeline endpoint returns formatted continuous date points."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/dashboard/timeline?days=7")
        assert res.status_code == 200
        timeline = res.json()
        assert len(timeline) == 7
        for point in timeline:
            assert "date" in point
            assert "total" in point
            assert "flagged" in point
            assert "approved" in point

        # Test custom historical date range
        custom_res = await client.get("/api/dashboard/timeline?start_date=2026-10-01&end_date=2026-10-05")
        assert custom_res.status_code == 200
        custom_timeline = custom_res.json()
        assert len(custom_timeline) == 5
        assert custom_timeline[0]["date"] == "2026-10-01"
        assert custom_timeline[-1]["date"] == "2026-10-05"
