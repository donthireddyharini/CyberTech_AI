"""Feedback and error analysis endpoints."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.feedback import FeedbackRecord
from app.models.user import User
from app.api.v1.auth import get_current_user_optional
from app.schemas.schemas import FeedbackRequest, FeedbackSchema, ErrorAnalysisSchema

router = APIRouter()


@router.post("", response_model=FeedbackSchema)
async def submit_feedback(
    request: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Submit human feedback on a model prediction.
    Performs an upsert if feedback already exists for this record_id to prevent duplicates.
    """
    existing = None
    if request.record_id:
        existing_res = await db.execute(
            select(FeedbackRecord).where(FeedbackRecord.record_id == request.record_id)
        )
        existing = existing_res.scalars().first()

    if existing:
        existing.predicted_labels = request.predicted_labels
        existing.corrected_labels = request.corrected_labels
        existing.predicted_severity = request.predicted_severity
        existing.corrected_severity = request.corrected_severity
        existing.is_false_positive = request.is_false_positive
        existing.is_false_negative = request.is_false_negative
        existing.is_ambiguous = request.is_ambiguous
        existing.is_confirmed = request.is_confirmed
        existing.explanation = request.explanation
        existing.language = request.language
        existing.model_version = request.model_version
        existing.reviewer_id = request.reviewer_id
        if current_user:
            existing.user_id = current_user.id
        await db.commit()
        await db.refresh(existing)
        return existing

    feedback = FeedbackRecord(
        id=str(uuid.uuid4()),
        record_id=request.record_id,
        predicted_labels=request.predicted_labels,
        corrected_labels=request.corrected_labels,
        predicted_severity=request.predicted_severity,
        corrected_severity=request.corrected_severity,
        is_false_positive=request.is_false_positive,
        is_false_negative=request.is_false_negative,
        is_ambiguous=request.is_ambiguous,
        is_confirmed=request.is_confirmed,
        explanation=request.explanation,
        language=request.language,
        model_version=request.model_version,
        reviewer_id=request.reviewer_id,
        user_id=current_user.id if current_user else None,
        validation_status="pending",
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return feedback


@router.get("/errors", response_model=ErrorAnalysisSchema)
async def get_error_analysis(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get error analysis summary scoped to user feedback or workspace feedback."""
    stmt = select(FeedbackRecord)
    if current_user:
        user_res = await db.execute(select(FeedbackRecord).where(FeedbackRecord.user_id == current_user.id))
        all_feedback = user_res.scalars().all()
    else:
        result = await db.execute(stmt)
        all_feedback = result.scalars().all()

    total = len(all_feedback)
    fps = sum(1 for f in all_feedback if f.is_false_positive)
    fns = sum(1 for f in all_feedback if f.is_false_negative)
    ambig = sum(1 for f in all_feedback if f.is_ambiguous)
    confirmed = sum(1 for f in all_feedback if f.is_confirmed)
    pending = sum(1 for f in all_feedback if f.validation_status == "pending")

    # By language
    by_lang: dict = {}
    for f in all_feedback:
        lang = f.language or "unknown"
        if lang not in by_lang:
            by_lang[lang] = {"total": 0, "fp": 0, "fn": 0, "ambiguous": 0}
        by_lang[lang]["total"] += 1
        if f.is_false_positive:
            by_lang[lang]["fp"] += 1
        if f.is_false_negative:
            by_lang[lang]["fn"] += 1
        if f.is_ambiguous:
            by_lang[lang]["ambiguous"] += 1

    # By model version
    by_version: dict = {}
    for f in all_feedback:
        v = f.model_version or "unknown"
        if v not in by_version:
            by_version[v] = {"total": 0, "fp": 0, "fn": 0}
        by_version[v]["total"] += 1
        if f.is_false_positive:
            by_version[v]["fp"] += 1
        if f.is_false_negative:
            by_version[v]["fn"] += 1

    denom = max(total, 1)
    return ErrorAnalysisSchema(
        total_feedback=total,
        false_positives=fps,
        false_negatives=fns,
        ambiguous=ambig,
        confirmed=confirmed,
        fp_rate=round(fps / denom, 4),
        fn_rate=round(fns / denom, 4),
        by_language=by_lang,
        by_model_version=by_version,
        pending_validation=pending,
    )


@router.get("")
async def list_feedback(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    validation_status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all feedback records."""
    query = select(FeedbackRecord)
    if validation_status:
        query = query.where(FeedbackRecord.validation_status == validation_status)
    
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar()

    query = query.order_by(FeedbackRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "items": [
            {
                "id": f.id,
                "record_id": f.record_id,
                "is_false_positive": f.is_false_positive,
                "is_false_negative": f.is_false_negative,
                "is_ambiguous": f.is_ambiguous,
                "is_confirmed": f.is_confirmed,
                "language": f.language,
                "model_version": f.model_version,
                "validation_status": f.validation_status,
                "explanation": f.explanation,
                "created_at": f.created_at.isoformat(),
            }
            for f in items
        ],
    }


@router.get("/export")
async def export_feedback_dataset(
    format: str = Query("csv", pattern="^(csv|jsonl)$"),
    db: AsyncSession = Depends(get_db)
):
    """Export reviewed feedback examples for offline model retraining."""
    from app.api.v1.monitor import export_reviewed_feedback
    return await export_reviewed_feedback(format=format, db=db)

