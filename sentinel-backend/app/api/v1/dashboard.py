"""Dashboard summary, distribution, and real-time analytics endpoints."""
import json
from pathlib import Path
from datetime import datetime, date, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, or_, case
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.models.moderation import ModerationRecord
from app.models.feedback import DatasetRun
from app.models.user import User
from app.api.v1.auth import get_current_user_optional
from app.nlp.engine import get_nlp_engine
from app.schemas.schemas import DashboardSummarySchema, DistributionSchema, DatasetRunSchema

router = APIRouter()
REPORT_PATH = Path("reports/evaluation_report.json")


def get_app_timezone() -> ZoneInfo:
    """Return the configured application timezone or default to UTC."""
    tz_str = getattr(settings, "APP_TIMEZONE", "UTC") or "UTC"
    try:
        return ZoneInfo(tz_str)
    except Exception:
        return ZoneInfo("UTC")


def get_local_day_bounds_utc(tz: Optional[ZoneInfo] = None, target_date: Optional[date] = None) -> tuple[datetime, datetime]:
    """
    Get UTC naive datetime bounds [start_utc, end_utc] corresponding to 
    local day start (00:00:00.000000) and local day end (23:59:59.999999).
    """
    if tz is None:
        tz = get_app_timezone()
    now_local = datetime.now(tz)
    day = target_date or now_local.date()
    local_start = datetime(day.year, day.month, day.day, 0, 0, 0, 0, tzinfo=tz)
    local_end = datetime(day.year, day.month, day.day, 23, 59, 59, 999999, tzinfo=tz)
    
    start_utc = local_start.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = local_end.astimezone(timezone.utc).replace(tzinfo=None)
    return start_utc, end_utc


def _get_date_bounds(filter_val: str, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Calculate datetime bounds based on the specified filter and local application timezone."""
    normalized = (filter_val or "all").lower().strip()
    tz = get_app_timezone()
    now_local = datetime.now(tz)

    # 1. Custom date range or explicit start/end dates
    if start_date or end_date or normalized == "custom":
        try:
            s_str = (start_date or end_date or "").strip()
            e_str = (end_date or start_date or "").strip()
            if s_str and e_str:
                if len(s_str) <= 10 and len(e_str) <= 10:
                    d_start = date.fromisoformat(s_str)
                    d_end = date.fromisoformat(e_str)
                    if d_start > d_end:
                        d_start, d_end = d_end, d_start
                    local_start = datetime(d_start.year, d_start.month, d_start.day, 0, 0, 0, 0, tzinfo=tz)
                    local_end = datetime(d_end.year, d_end.month, d_end.day, 23, 59, 59, 999999, tzinfo=tz)
                    s_utc = local_start.astimezone(timezone.utc).replace(tzinfo=None)
                    e_utc = local_end.astimezone(timezone.utc).replace(tzinfo=None)
                    return s_utc, e_utc
                else:
                    s = datetime.fromisoformat(s_str.replace("Z", "+00:00"))
                    e = datetime.fromisoformat(e_str.replace("Z", "+00:00"))
                    if s.tzinfo is None:
                        s = s.replace(tzinfo=tz)
                    if e.tzinfo is None:
                        e = e.replace(tzinfo=tz)
                    s_utc = s.astimezone(timezone.utc).replace(tzinfo=None)
                    e_utc = e.astimezone(timezone.utc).replace(tzinfo=None)
                    if s_utc > e_utc:
                        s_utc, e_utc = e_utc, s_utc
                    return s_utc, e_utc
        except Exception:
            pass

    # 2. Preset filters
    if normalized == "today":
        return get_local_day_bounds_utc(tz)
    elif normalized == "yesterday":
        yesterday_date = now_local.date() - timedelta(days=1)
        return get_local_day_bounds_utc(tz, target_date=yesterday_date)
    elif normalized in ("7d", "7_days", "week"):
        start_local = now_local - timedelta(days=7)
        return start_local.astimezone(timezone.utc).replace(tzinfo=None), now_local.astimezone(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)
    elif normalized in ("30d", "30_days", "month"):
        start_local = now_local - timedelta(days=30)
        return start_local.astimezone(timezone.utc).replace(tzinfo=None), now_local.astimezone(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)
    return None, None


@router.get("/summary", response_model=DashboardSummarySchema)
async def dashboard_summary(
    timeframe: Optional[str] = Query(None, description="today|yesterday|7d|30d|all"),
    time_range: Optional[str] = Query(None, description="today|yesterday|7d|30d|all"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    platform: Optional[str] = Query(None, description="Filter by platform: youtube, x, manual, csv_upload"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get genuine dashboard summary metrics calculated from database records.
    Filters by user ownership (including shared unassigned records), date bounds, and platform.
    """
    selected_filter = timeframe or time_range or "all"
    start_dt, end_dt = _get_date_bounds(selected_filter, start_date, end_date)
    conditions = []

    # Multi-tenant scoping: Include user's own records as well as shared unassigned operational records.
    if current_user:
        conditions.append(or_(ModerationRecord.user_id == current_user.id, ModerationRecord.user_id.is_(None)))
    else:
        conditions.append(ModerationRecord.user_id.is_(None))

    if start_dt and end_dt:
        conditions.append(ModerationRecord.created_at >= start_dt)
        conditions.append(ModerationRecord.created_at <= end_dt)

    if platform and platform.lower() != "all":
        p_clean = platform.lower().strip()
        if p_clean in ("instagram", "ig"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["instagram", "ig"]))
        elif p_clean in ("twitter", "x"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["x", "twitter"]))
        elif p_clean in ("csv", "csv_upload"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["csv", "csv_upload", "batch_file"]))
        else:
            conditions.append(func.lower(ModerationRecord.platform) == p_clean)

    where_clause = and_(*conditions) if conditions else True

    # 1. Total analyzed comments
    total = (await db.execute(
        select(func.count(ModerationRecord.id)).where(where_clause)
    )).scalar() or 0

    # 2. Flagged predictions
    flagged = (await db.execute(
        select(func.count(ModerationRecord.id)).where(
            and_(
                where_clause,
                or_(
                    ModerationRecord.decision.in_(["flag_for_review", "escalate"]),
                    ModerationRecord.status == "flagged",
                    ModerationRecord.severity.in_(["high", "medium"])
                )
            )
        )
    )).scalar() or 0

    # 3. Non-flagged predictions
    non_flagged = max(0, total - flagged)
    violation_rate = round((flagged / total * 100.0), 2) if total > 0 else 0.0
    clean_rate = round((non_flagged / total * 100.0), 2) if total > 0 else 0.0

    # 4. Pending review
    pending = (await db.execute(
        select(func.count(ModerationRecord.id)).where(
            and_(where_clause, ModerationRecord.status == "pending")
        )
    )).scalar() or 0

    # 5. High-priority cases
    high_priority = (await db.execute(
        select(func.count(ModerationRecord.id)).where(
            and_(where_clause, ModerationRecord.severity == "high")
        )
    )).scalar() or 0

    # 6. Analyzed today (grounded strictly in created_at within local day boundary converted to UTC)
    today_start_utc, today_end_utc = get_local_day_bounds_utc()
    today_conditions = [
        ModerationRecord.created_at >= today_start_utc,
        ModerationRecord.created_at <= today_end_utc,
    ]
    if current_user:
        today_conditions.append(or_(ModerationRecord.user_id == current_user.id, ModerationRecord.user_id.is_(None)))
    else:
        today_conditions.append(ModerationRecord.user_id.is_(None))

    today_analyzed = (await db.execute(
        select(func.count(ModerationRecord.id)).where(and_(*today_conditions))
    )).scalar() or 0

    # 7. Completed dataset runs and samples processed
    run_conditions = [DatasetRun.status == "completed"]
    if current_user:
        run_conditions.append(or_(DatasetRun.user_id == current_user.id, DatasetRun.user_id.is_(None)))
    else:
        run_conditions.append(DatasetRun.user_id.is_(None))
    if start_dt and end_dt:
        run_conditions.append(DatasetRun.created_at >= start_dt)
        run_conditions.append(DatasetRun.created_at <= end_dt)

    completed_dataset_runs = (await db.execute(
        select(func.count(DatasetRun.id)).where(and_(*run_conditions))
    )).scalar() or 0

    dataset_samples_processed = (await db.execute(
        select(func.sum(DatasetRun.processed_count)).where(and_(*run_conditions))
    )).scalar() or 0

    engine = get_nlp_engine()
    is_trained = engine.toxicity_predictor is not None and engine.toxicity_predictor.is_available()

    return DashboardSummarySchema(
        total_analyzed=total,
        flagged_comments=flagged,
        non_flagged_comments=non_flagged,
        pending_review=pending,
        high_priority=high_priority,
        today_analyzed=today_analyzed,
        violation_rate=violation_rate,
        clean_rate=clean_rate,
        completed_dataset_runs=completed_dataset_runs,
        dataset_samples_processed=int(dataset_samples_processed or 0),
        model_name="sentinel-hybrid-multilingual" if is_trained else settings.MODEL_NAME,
        model_version=settings.MODEL_VERSION,
        model_type="hybrid_ml_and_rule_baseline" if is_trained else "rule_based_baseline",
        model_status="ready",
        is_demo=False,
    )


@router.get("/distributions", response_model=DistributionSchema)
async def dashboard_distributions(
    timeframe: Optional[str] = Query(None),
    time_range: Optional[str] = Query(None),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    platform: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get real severity, category, language, and platform distributions based on genuine database records."""
    selected_filter = timeframe or time_range or "all"
    start_dt, end_dt = _get_date_bounds(selected_filter, start_date, end_date)
    conditions = []

    if current_user:
        conditions.append(or_(ModerationRecord.user_id == current_user.id, ModerationRecord.user_id.is_(None)))
    else:
        conditions.append(ModerationRecord.user_id.is_(None))
    if start_dt and end_dt:
        conditions.append(ModerationRecord.created_at >= start_dt)
        conditions.append(ModerationRecord.created_at <= end_dt)

    # Base conditions without platform for platform distribution
    base_where_clause = and_(*conditions) if conditions else True

    if platform and platform.lower() != "all":
        p_clean = platform.lower().strip()
        if p_clean in ("instagram", "ig"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["instagram", "ig"]))
        elif p_clean in ("twitter", "x"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["x", "twitter"]))
        elif p_clean in ("csv", "csv_upload"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["csv", "csv_upload", "batch_file"]))
        else:
            conditions.append(func.lower(ModerationRecord.platform) == p_clean)

    where_clause = and_(*conditions) if conditions else True

    # Severity distribution
    sev_result = await db.execute(
        select(ModerationRecord.severity, func.count(ModerationRecord.id))
        .where(where_clause)
        .group_by(ModerationRecord.severity)
    )
    severity_dist = {k or "low": v for k, v in dict(sev_result.all()).items()}

    # Category distribution
    records_result = await db.execute(
        select(
            ModerationRecord.hate_speech_score,
            ModerationRecord.harassment_score,
            ModerationRecord.cyberbullying_score,
            ModerationRecord.legitimate_score,
        ).where(where_clause)
    )
    records = records_result.all()
    category_dist = {"hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 0}
    for r in records:
        scores = {
            "hate_speech": r[0] or 0.0,
            "harassment": r[1] or 0.0,
            "cyberbullying": r[2] or 0.0,
            "legitimate": r[3] or 0.0
        }
        best = max(scores, key=scores.get)
        if scores[best] > 0.2:
            category_dist[best] += 1
        else:
            category_dist["legitimate"] += 1

    # Language distribution
    lang_result = await db.execute(
        select(ModerationRecord.detected_language, func.count(ModerationRecord.id))
        .where(where_clause)
        .group_by(ModerationRecord.detected_language)
    )
    lang_dist = {k or "english": v for k, v in dict(lang_result.all()).items()}

    # Platform distribution (across all platforms for the current scope)
    plat_result = await db.execute(
        select(ModerationRecord.platform, func.count(ModerationRecord.id))
        .where(base_where_clause)
        .group_by(ModerationRecord.platform)
    )
    raw_plat_dist = dict(plat_result.all())
    platform_dist = {
        "youtube": 0,
        "instagram": 0,
        "manual": 0,
        "csv_upload": 0,
    }
    for k, v in raw_plat_dist.items():
        key = (k or "manual").lower().strip()
        if key in ("instagram", "ig"):
            platform_dist["instagram"] += v
        elif key in ("csv", "csv_upload", "batch_file"):
            platform_dist["csv_upload"] += v
        elif key in ("twitter", "x"):
            platform_dist["instagram"] += v
        elif key in platform_dist:
            platform_dist[key] += v
        else:
            platform_dist["manual"] += v

    return DistributionSchema(
        severity_distribution=severity_dist,
        category_distribution=category_dist,
        language_distribution=lang_dist,
        platform_distribution=platform_dist,
    )


@router.get("/timeline")
async def dashboard_timeline(
    days: int = 7,
    timeframe: Optional[str] = Query(None),
    time_range: Optional[str] = Query(None),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    platform: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get time-series detection activity over selected date range and optional platform."""
    selected_filter = timeframe or time_range or "all"
    start_dt, end_dt = _get_date_bounds(selected_filter, start_date, end_date)
    now = datetime.utcnow()

    if start_dt and end_dt:
        start_day = datetime(start_dt.year, start_dt.month, start_dt.day)
        end_day = datetime(end_dt.year, end_dt.month, end_dt.day)
        num_days = max(1, (end_day - start_day).days + 1)
        num_days = min(num_days, 180)
    else:
        if selected_filter == "30d":
            days = 30
        elif selected_filter in ("today", "yesterday"):
            days = 2
        num_days = max(1, days)
        start_day = datetime(now.year, now.month, now.day) - timedelta(days=num_days - 1)
        start_dt = start_day
        end_dt = now + timedelta(hours=1)

    conditions = [
        ModerationRecord.created_at >= start_dt,
        ModerationRecord.created_at <= end_dt
    ]
    if current_user:
        conditions.append(or_(ModerationRecord.user_id == current_user.id, ModerationRecord.user_id.is_(None)))
    else:
        conditions.append(ModerationRecord.user_id.is_(None))

    if platform and platform.lower() != "all":
        p_clean = platform.lower().strip()
        if p_clean in ("instagram", "ig"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["instagram", "ig"]))
        elif p_clean in ("twitter", "x"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["x", "twitter"]))
        elif p_clean in ("csv", "csv_upload"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["csv", "csv_upload", "batch_file"]))
        else:
            conditions.append(func.lower(ModerationRecord.platform) == p_clean)

    stmt = select(
        func.date(ModerationRecord.created_at).label("day"),
        func.count(ModerationRecord.id).label("total"),
        func.sum(
            case(
                (
                    or_(
                        ModerationRecord.decision == "flag_for_review",
                        ModerationRecord.decision == "human_review",
                        ModerationRecord.severity.in_(["high", "medium"])
                    ),
                    1
                ),
                else_=0
            )
        ).label("flagged"),
        func.sum(
            case(
                (
                    and_(
                        ModerationRecord.decision == "no_action",
                        ModerationRecord.severity.in_(["low", "none"])
                    ),
                    1
                ),
                else_=0
            )
        ).label("approved")
    ).where(and_(*conditions)).group_by(func.date(ModerationRecord.created_at)).order_by("day")

    res = await db.execute(stmt)
    timeline_map = {
        str(row[0]): {
            "date": str(row[0]),
            "total": row[1] or 0,
            "flagged": row[2] or 0,
            "approved": row[3] or 0
        }
        for row in res.all()
    }

    # Fill dates continuously across the selected range
    result = []
    for i in range(num_days):
        d_str = (start_day + timedelta(days=i)).strftime("%Y-%m-%d")
        if d_str in timeline_map:
            result.append(timeline_map[d_str])
        else:
            result.append({"date": d_str, "total": 0, "flagged": 0, "approved": 0})

    return result


@router.get("/recent")
async def recent_activity(
    limit: int = 10,
    timeframe: Optional[str] = Query(None),
    time_range: Optional[str] = Query(None),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    platform: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get recent moderation activity for authenticated user or overall workspace."""
    selected_filter = timeframe or time_range or "all"
    start_dt, end_dt = _get_date_bounds(selected_filter, start_date, end_date)
    conditions = []

    if current_user:
        conditions.append(or_(ModerationRecord.user_id == current_user.id, ModerationRecord.user_id.is_(None)))
    else:
        conditions.append(ModerationRecord.user_id.is_(None))
    if start_dt and end_dt:
        conditions.append(ModerationRecord.created_at >= start_dt)
        conditions.append(ModerationRecord.created_at <= end_dt)

    if platform and platform.lower() != "all":
        p_clean = platform.lower().strip()
        if p_clean in ("instagram", "ig"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["instagram", "ig"]))
        elif p_clean in ("twitter", "x"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["x", "twitter"]))
        elif p_clean in ("csv", "csv_upload"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["csv", "csv_upload", "batch_file"]))
        else:
            conditions.append(func.lower(ModerationRecord.platform) == p_clean)

    where_clause = and_(*conditions) if conditions else True

    result = await db.execute(
        select(ModerationRecord)
        .where(where_clause)
        .order_by(ModerationRecord.created_at.desc())
        .limit(limit)
    )
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "text_preview": r.original_text[:120] + ("..." if len(r.original_text) > 120 else ""),
            "severity": r.severity,
            "decision": r.decision,
            "status": r.status,
            "detected_language": r.detected_language or "english",
            "hate_speech_score": round(r.hate_speech_score or 0.0, 3),
            "harassment_score": round(r.harassment_score or 0.0, 3),
            "cyberbullying_score": round(r.cyberbullying_score or 0.0, 3),
            "platform": r.platform or "manual",
            "source_url": r.source_url,
            "author_name": r.author_name,
            "source_id": r.source_id,
            "created_at": r.created_at.isoformat() if r.created_at else datetime.utcnow().isoformat(),
        }
        for r in records
    ]


@router.get("/review-queue")
async def review_queue(
    limit: int = 10,
    platform: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get pending items for the review queue."""
    conditions = [ModerationRecord.status == "pending"]
    if current_user:
        conditions.append(or_(ModerationRecord.user_id == current_user.id, ModerationRecord.user_id.is_(None)))
    else:
        conditions.append(ModerationRecord.user_id.is_(None))

    if platform and platform.lower() != "all":
        p_clean = platform.lower().strip()
        if p_clean in ("instagram", "ig"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["instagram", "ig"]))
        elif p_clean in ("twitter", "x"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["x", "twitter"]))
        elif p_clean in ("csv", "csv_upload"):
            conditions.append(func.lower(ModerationRecord.platform).in_(["csv", "csv_upload", "batch_file"]))
        else:
            conditions.append(func.lower(ModerationRecord.platform) == p_clean)

    result = await db.execute(
        select(ModerationRecord)
        .where(and_(*conditions))
        .order_by(ModerationRecord.created_at.desc())
        .limit(limit)
    )
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "text_preview": r.original_text[:120] + ("..." if len(r.original_text) > 120 else ""),
            "severity": r.severity,
            "decision": r.decision,
            "detected_language": r.detected_language or "english",
            "ambiguity_warning": r.ambiguity_warning,
            "hate_speech_score": round(r.hate_speech_score or 0.0, 3),
            "harassment_score": round(r.harassment_score or 0.0, 3),
            "cyberbullying_score": round(r.cyberbullying_score or 0.0, 3),
            "platform": r.platform or "manual",
            "source_url": r.source_url,
            "author_name": r.author_name,
            "source_id": r.source_id,
            "created_at": r.created_at.isoformat() if r.created_at else datetime.utcnow().isoformat(),
        }
        for r in records
    ]


@router.get("/dataset-runs", response_model=List[DatasetRunSchema])
async def list_dashboard_dataset_runs(
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """List completed dataset detection runs for dashboard summary."""
    conditions = []
    if current_user:
        conditions.append(or_(DatasetRun.user_id == current_user.id, DatasetRun.user_id.is_(None)))
    else:
        conditions.append(DatasetRun.user_id.is_(None))

    where_clause = and_(*conditions) if conditions else True
    result = await db.execute(
        select(DatasetRun).where(where_clause).order_by(DatasetRun.created_at.desc()).limit(limit)
    )
    runs = result.scalars().all()
    return [
        DatasetRunSchema(
            id=r.id,
            dataset_name=r.dataset_name,
            dataset_id=r.dataset_id,
            status=r.status,
            total_samples=r.total_samples,
            processed_count=r.processed_count,
            failed_count=r.failed_count,
            flagged_count=r.flagged_count,
            approved_count=r.approved_count,
            language_breakdown=r.language_breakdown,
            severity_breakdown=r.severity_breakdown,
            processing_time_ms=r.processing_time_ms,
            created_at=r.created_at.isoformat() if r.created_at else datetime.utcnow().isoformat(),
        )
        for r in runs
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
