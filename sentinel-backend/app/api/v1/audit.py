"""Audit trail endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.feedback import AuditEvent
from app.api.v1.auth import get_current_user_optional
from app.models.user import User

router = APIRouter()


@router.get("")
async def list_audit_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    event_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """List audit events with account isolation."""
    query = select(AuditEvent)
    if current_user:
        if current_user.role != "admin":
            query = query.where(AuditEvent.actor_id == current_user.id)
    else:
        query = query.where(AuditEvent.actor_id.is_(None))
    if event_type:
        query = query.where(AuditEvent.event_type == event_type)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar()

    query = query.order_by(AuditEvent.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    events = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "items": [
            {
                "id": e.id,
                "record_id": e.record_id,
                "event_type": e.event_type,
                "actor_id": e.actor_id,
                "actor_name": e.actor_name,
                "details": e.details,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ],
    }
