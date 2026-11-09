"""Moderation command center endpoints."""
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.v1.auth import get_current_user_optional
from app.models.user import User
from app.models.moderation import ModerationRecord, HumanReview
from app.models.feedback import AuditEvent
from app.schemas.schemas import ModerationRecordSchema, ModerationDetailSchema, ReviewDecisionRequest

router = APIRouter()


@router.get("", response_model=dict)
async def list_moderation_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    decision: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """List moderation records with account-isolated filtering and pagination."""
    query = select(ModerationRecord)
    if current_user:
        if current_user.role != 'admin':
            query = query.where(ModerationRecord.user_id == current_user.id)
    else:
        query = query.where(ModerationRecord.user_id.is_(None))
    
    if status:
        query = query.where(ModerationRecord.status == status)
    if severity:
        query = query.where(ModerationRecord.severity == severity)
    if language:
        query = query.where(ModerationRecord.detected_language == language)
    if decision:
        query = query.where(ModerationRecord.decision == decision)
    if platform and platform.lower() != "all":
        p_clean = platform.lower().strip()
        if p_clean in ("instagram", "ig"):
            query = query.where(func.lower(ModerationRecord.platform).in_(["instagram", "ig"]))
        elif p_clean in ("twitter", "x"):
            query = query.where(func.lower(ModerationRecord.platform).in_(["x", "twitter"]))
        elif p_clean in ("csv", "csv_upload"):
            query = query.where(func.lower(ModerationRecord.platform).in_(["csv", "csv_upload", "batch_file"]))
        else:
            query = query.where(func.lower(ModerationRecord.platform) == p_clean)
    if search:
        query = query.where(ModerationRecord.original_text.ilike(f"%{search}%"))

    # Total count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar()

    # Sort
    sort_col = getattr(ModerationRecord, sort_by, ModerationRecord.created_at)
    if sort_order == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    records = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),
        "items": [
            {
                "id": r.id,
                "original_text": r.original_text[:200] + ("..." if len(r.original_text) > 200 else ""),
                "severity": r.severity,
                "decision": r.decision,
                "status": r.status,
                "detected_language": r.detected_language,
                "hate_speech_score": r.hate_speech_score,
                "harassment_score": r.harassment_score,
                "cyberbullying_score": r.cyberbullying_score,
                "legitimate_score": r.legitimate_score,
                "model_name": r.model_name,
                "model_version": r.model_version,
                "platform": r.platform,
                "source_id": r.source_id,
                "source_url": r.source_url,
                "author_name": r.author_name,
                "parent_comment_id": r.parent_comment_id,
                "is_demo": r.is_demo,
                "is_code_mixed": r.is_code_mixed,
                "created_at": r.created_at.isoformat(),
                "ambiguity_warning": r.ambiguity_warning,
                "recommended_action": r.recommended_action,
            }
            for r in records
        ],
    }


@router.get("/{record_id}")
async def get_moderation_record(
    record_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Get full detail for a moderation record with account ownership verification."""
    result = await db.execute(select(ModerationRecord).where(ModerationRecord.id == record_id))
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if record.user_id:
        if not current_user or (current_user.role != 'admin' and record.user_id != current_user.id):
            raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to view this record.")
    
    reviews_result = await db.execute(select(HumanReview).where(HumanReview.record_id == record_id))
    reviews = reviews_result.scalars().all()

    return {
        "id": record.id,
        "original_text": record.original_text,
        "normalized_text": record.normalized_text,
        "context_before": record.context_before,
        "context_after": record.context_after,
        "labels": record.labels,
        "hate_speech_score": record.hate_speech_score,
        "harassment_score": record.harassment_score,
        "cyberbullying_score": record.cyberbullying_score,
        "legitimate_score": record.legitimate_score,
        "severity": record.severity,
        "severity_reason": record.severity_reason,
        "decision": record.decision,
        "confidence_level": record.confidence_level,
        "recommended_action": record.recommended_action,
        "ambiguity_warning": record.ambiguity_warning,
        "detected_language": record.detected_language,
        "is_code_mixed": record.is_code_mixed,
        "language_hint": record.language_hint,
        "status": record.status,
        "platform": record.platform,
        "source_id": record.source_id,
        "source_url": record.source_url,
        "author_name": record.author_name,
        "parent_comment_id": record.parent_comment_id,
        "is_demo": record.is_demo,
        "model_name": record.model_name,
        "model_version": record.model_version,
        "inference_timestamp": record.inference_timestamp,
        "processing_time_ms": record.processing_time_ms,
        "created_at": record.created_at.isoformat(),
        "reviews": [
            {
                "id": r.id,
                "action": r.action,
                "corrected_labels": r.corrected_labels,
                "corrected_severity": r.corrected_severity,
                "reviewer_notes": r.reviewer_notes,
                "override_reason": r.override_reason,
                "reviewer_id": r.reviewer_id,
                "reviewer_name": r.reviewer_name,
                "created_at": r.created_at.isoformat(),
            }
            for r in reviews
        ],
    }


@router.post("/{record_id}/decision")
async def submit_review_decision(
    record_id: str,
    request: ReviewDecisionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Submit a human moderator decision on a record with ownership verification."""
    result = await db.execute(select(ModerationRecord).where(ModerationRecord.id == record_id))
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if record.user_id:
        if not current_user or (current_user.role != 'admin' and record.user_id != current_user.id):
            raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to review this record.")

    # Update status and reconcile decision with human moderator adjudication
    status_map = {
        "approve": "reviewed",
        "dismiss": "dismissed",
        "escalate": "escalated",
        "further_review": "pending",
    }
    record.status = status_map.get(request.action, "reviewed")

    # Reconcile operational decision so Dashboard metrics and KPIs accurately reflect human moderation
    if request.action == "approve":
        record.decision = "no_action"
        if request.corrected_severity:
            record.severity = request.corrected_severity
        else:
            record.severity = "low"
    elif request.action == "dismiss":
        record.decision = "no_action"
        record.severity = "low"
    elif request.action == "escalate":
        record.decision = "escalate"
        if request.corrected_severity:
            record.severity = request.corrected_severity
        else:
            record.severity = "high"
    elif request.action in ("flag", "confirm_violation"):
        record.decision = "flag_for_review"
        record.status = "flagged"
        if request.corrected_severity:
            record.severity = request.corrected_severity
        else:
            record.severity = "high"

    # Create review record
    review = HumanReview(
        id=str(uuid.uuid4()),
        record_id=record_id,
        action=request.action,
        corrected_labels=request.corrected_labels,
        corrected_severity=request.corrected_severity,
        reviewer_notes=request.reviewer_notes,
        override_reason=request.override_reason,
        reviewer_id=request.reviewer_id,
        reviewer_name=request.reviewer_name,
    )
    db.add(review)

    # Audit event
    audit = AuditEvent(
        id=str(uuid.uuid4()),
        record_id=record_id,
        event_type="moderation_decision",
        actor_id=request.reviewer_id,
        actor_name=request.reviewer_name,
        details={
            "action": request.action,
            "corrected_severity": request.corrected_severity,
            "override_reason": request.override_reason,
        },
    )
    db.add(audit)
    await db.commit()

    return {"message": "Decision recorded", "new_status": record.status, "review_id": review.id}
