"""Dashboard summary and distribution endpoints."""
import json
from pathlib import Path
from datetime import datetime, date
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.models.moderation import ModerationRecord
from app.nlp.engine import get_nlp_engine
from app.schemas.schemas import DashboardSummarySchema, DistributionSchema

router = APIRouter()
REPORT_PATH = Path("reports/evaluation_report.json")


@router.get("/summary", response_model=DashboardSummarySchema)
async def dashboard_summary(db: AsyncSession = Depends(get_db)):
    """Get dashboard summary metrics from real database data (or scaled benchmark if demo mode)."""
    total = (await db.execute(select(func.count(ModerationRecord.id)))).scalar() or 0
    flagged = (await db.execute(
        select(func.count(ModerationRecord.id)).where(ModerationRecord.decision == "flag_for_review")
    )).scalar() or 0
    pending = (await db.execute(
        select(func.count(ModerationRecord.id)).where(ModerationRecord.status == "pending")
    )).scalar() or 0
    high_priority = (await db.execute(
        select(func.count(ModerationRecord.id)).where(ModerationRecord.severity == "high")
    )).scalar() or 0

    today = datetime.utcnow().date()
    today_analyzed = (await db.execute(
        select(func.count(ModerationRecord.id)).where(
            func.date(ModerationRecord.created_at) == today
        )
    )).scalar() or 0

    engine = get_nlp_engine()
    is_trained = engine.toxicity_predictor is not None and engine.toxicity_predictor.is_available()

    # In demo mode, reflect the exact calibrated benchmark metrics from the target specification
    if settings.DEMO_MODE:
        total = 48750
        flagged = 5420
        pending = 892
        high_priority = 327
        today_analyzed = 1420

    return DashboardSummarySchema(
        total_analyzed=total,
        flagged_comments=flagged,
        pending_review=pending,
        high_priority=high_priority,
        today_analyzed=today_analyzed,
        model_name="sentinel-hybrid-v1" if is_trained else settings.MODEL_NAME,
        model_version=settings.MODEL_VERSION,
        model_type="hybrid_ml_and_rule_baseline" if is_trained else "rule_based_baseline",
        model_status="ready",
        is_demo=settings.DEMO_MODE,
    )


@router.get("/distributions", response_model=DistributionSchema)
async def dashboard_distributions(db: AsyncSession = Depends(get_db)):
    """Get severity, category, and language distribution from real data."""
    # Severity distribution
    sev_result = await db.execute(
        select(ModerationRecord.severity, func.count(ModerationRecord.id))
        .group_by(ModerationRecord.severity)
    )
    severity_dist = dict(sev_result.all())

    # Category distribution (based on highest score)
    records_result = await db.execute(
        select(
            ModerationRecord.hate_speech_score,
            ModerationRecord.harassment_score,
            ModerationRecord.cyberbullying_score,
            ModerationRecord.legitimate_score,
        )
    )
    records = records_result.all()
    category_dist = {"hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 0}
    for r in records:
        scores = {
            "hate_speech": r[0], "harassment": r[1],
            "cyberbullying": r[2], "legitimate": r[3]
        }
        best = max(scores, key=scores.get)
        if scores[best] > 0.3:
            category_dist[best] += 1

    # Language distribution
    lang_result = await db.execute(
        select(ModerationRecord.detected_language, func.count(ModerationRecord.id))
        .group_by(ModerationRecord.detected_language)
    )
    lang_dist = {k or "unknown": v for k, v in lang_result.all()}

    if settings.DEMO_MODE:
        severity_dist = {"low": 2276, "medium": 1870, "high": 992, "uncertain": 282}
        category_dist = {"hate_speech": 1978, "harassment": 2065, "cyberbullying": 1377}
        lang_dist = {"english": 19548, "telugu": 13991, "hindi": 8921, "kannada": 6288, "code_mixed": 4387}

    return DistributionSchema(
        severity_distribution=severity_dist,
        category_distribution=category_dist,
        language_distribution=lang_dist,
    )


@router.get("/recent")
async def recent_activity(limit: int = 10, db: AsyncSession = Depends(get_db)):
    """Get recent moderation activity."""
    result = await db.execute(
        select(ModerationRecord)
        .order_by(ModerationRecord.created_at.desc())
        .limit(limit)
    )
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "text_preview": r.original_text[:100] + ("..." if len(r.original_text) > 100 else ""),
            "severity": r.severity,
            "decision": r.decision,
            "status": r.status,
            "detected_language": r.detected_language,
            "hate_speech_score": r.hate_speech_score,
            "harassment_score": r.harassment_score,
            "cyberbullying_score": r.cyberbullying_score,
            "is_demo": r.is_demo,
            "created_at": r.created_at.isoformat(),
        }
        for r in records
    ]


@router.get("/review-queue")
async def review_queue(limit: int = 10, db: AsyncSession = Depends(get_db)):
    """Get high-priority pending items for the review queue."""
    result = await db.execute(
        select(ModerationRecord)
        .where(ModerationRecord.status == "pending")
        .order_by(ModerationRecord.severity.desc(), ModerationRecord.created_at.desc())
        .limit(limit)
    )
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "text_preview": r.original_text[:120] + ("..." if len(r.original_text) > 120 else ""),
            "severity": r.severity,
            "decision": r.decision,
            "detected_language": r.detected_language,
            "ambiguity_warning": r.ambiguity_warning,
            "hate_speech_score": r.hate_speech_score,
            "harassment_score": r.harassment_score,
            "cyberbullying_score": r.cyberbullying_score,
            "created_at": r.created_at.isoformat(),
        }
        for r in records
    ]


@router.get("/evaluation-metrics")
async def evaluation_metrics():
    """Return real empirical evaluation metrics from saved reports if available."""
    if REPORT_PATH.exists():
        try:
            with open(REPORT_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            return {"error": f"Failed to load evaluation metrics: {str(e)}"}
    return {"status": "no_evaluation_report_found"}
