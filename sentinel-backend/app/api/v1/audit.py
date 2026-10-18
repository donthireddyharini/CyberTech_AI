"""Audit trail endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.feedback import AuditEvent

router = APIRouter()


@router.get("")
async def list_audit_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    event_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all audit events."""
    query = select(AuditEvent)
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
