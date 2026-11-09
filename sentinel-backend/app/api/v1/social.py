"""
Social Media Ingestion & Connector API Router for CyberTech AI.
Endpoints for YouTube Data API v3 and Instagram Graph API v20.0.
Strict server-side credential management: credentials are never accepted from arbitrary clients or exposed in responses.
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.auth import get_current_user_optional
from app.models.user import User
from app.models.social import SocialSyncLog
from app.models.moderation import ModerationRecord
from app.connectors.manager import get_connector_manager
from app.connectors.youtube import YouTubeConnector
from app.connectors.instagram import InstagramConnector
from app.core.social_pipeline import ingest_social_comments

router = APIRouter()


class YouTubeFetchRequest(BaseModel):
    video_input: str = Field(..., description="YouTube video URL or 11-char Video ID")
    max_comments: int = Field(50, ge=1, le=500, description="Custom comment count to retrieve (e.g. 10, 50, 100, 250, 500)")
    include_replies: bool = Field(True, description="Whether to include comment replies")
    order: str = Field("relevance", description="'relevance' or 'time'")


class InstagramFetchRequest(BaseModel):
    media_input: str = Field(..., description="Instagram Post / Reel URL or Media ID")
    max_comments: int = Field(50, ge=1, le=500, description="Custom comment count to retrieve (e.g. 10, 50, 100, 250, 500)")
    include_replies: bool = Field(True, description="Whether to include comment replies")


@router.get("/connectors")
async def get_connectors_status():
    """
    Returns connectivity and diagnostic status for supported platforms (YouTube, Instagram).
    Never exposes API secrets, tokens, or credential values.
    """
    manager = get_connector_manager()
    statuses = await manager.get_all_statuses()
    return [
        {
            "platform": s.platform,
            "is_configured": s.is_configured,
            "status": s.status,
            "message": s.message,
            "last_sync_timestamp": s.last_sync_timestamp,
            "account_info": s.account_info,
            "rate_limit_info": s.rate_limit_info,
        }
        for s in statuses
    ]


@router.post("/youtube/fetch")
async def fetch_youtube_comments(
    payload: YouTubeFetchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Fetches real comments from YouTube Data API v3 and analyzes them using local ML models.
    Uses centrally configured server-side YouTube Data API key.
    """
    manager = get_connector_manager()
    yt_connector = manager.get_connector("youtube")
    assert isinstance(yt_connector, YouTubeConnector)

    try:
        comments, meta = await yt_connector.fetch_comments(
            target_input=payload.video_input,
            max_comments=payload.max_comments,
            include_replies=payload.include_replies,
            order=payload.order,
        )
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(re))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"YouTube comment fetch error: {str(exc)}"
        )

    # Ingest through local ML pipeline
    user_id = current_user.id if current_user else None
    result = await ingest_social_comments(
        db=db,
        comments=comments,
        platform="youtube",
        target_input=payload.video_input,
        user_id=user_id,
        requested_count=payload.max_comments
    )
    result["metadata"] = meta
    return result


@router.post("/instagram/fetch")
async def fetch_instagram_comments(
    payload: InstagramFetchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Fetches real comments from Instagram Graph API and analyzes them locally.
    Uses centrally configured server-side Instagram Access Token.
    """
    manager = get_connector_manager()
    ig_connector = manager.get_connector("instagram")
    assert isinstance(ig_connector, InstagramConnector)

    try:
        comments, meta = await ig_connector.fetch_comments(
            media_input=payload.media_input,
            max_comments=payload.max_comments,
            include_replies=payload.include_replies,
        )
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(re))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Instagram comment fetch error: {str(exc)}"
        )

    user_id = current_user.id if current_user else None
    result = await ingest_social_comments(
        db=db,
        comments=comments,
        platform="instagram",
        target_input=payload.media_input,
        user_id=user_id,
        requested_count=payload.max_comments
    )
    result["metadata"] = meta
    return result


@router.get("/sync-history")
async def get_sync_history(
    platform: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Returns recent social sync runs filtered by authenticated account."""
    q = select(SocialSyncLog)
    if current_user:
        if current_user.role != "admin":
            q = q.where(SocialSyncLog.user_id == current_user.id)
    else:
        q = q.where(SocialSyncLog.user_id.is_(None))
    if platform:
        q = q.where(SocialSyncLog.platform == platform)
    q = q.order_by(desc(SocialSyncLog.created_at)).limit(limit)

    res = await db.execute(q)
    logs = res.scalars().all()
    return [
        {
            "id": log.id,
            "platform": log.platform,
            "target_input": log.target_input,
            "total_fetched": log.total_fetched,
            "newly_ingested": log.newly_ingested,
            "duplicate_count": log.duplicate_count,
            "flagged_count": log.flagged_count,
            "approved_count": log.approved_count,
            "status": log.status,
            "error_message": log.error_message,
            "processing_time_ms": log.processing_time_ms,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


@router.get("/stats")
async def get_social_stats(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Returns aggregated platform distribution and intelligence statistics filtered by authenticated account."""
    from sqlalchemy import func, case
    q = select(
        ModerationRecord.platform,
        func.count(ModerationRecord.id).label("total"),
        func.sum(case((ModerationRecord.decision != "no_action", 1), else_=0)).label("flagged"),
        func.sum(case((ModerationRecord.decision == "no_action", 1), else_=0)).label("approved")
    )
    if current_user:
        if current_user.role != "admin":
            q = q.where(ModerationRecord.user_id == current_user.id)
    else:
        q = q.where(ModerationRecord.user_id.is_(None))
    q = q.group_by(ModerationRecord.platform)

    res = await db.execute(q)
    rows = res.all()

    platforms: Dict[str, Dict[str, int]] = {
        "youtube": {"total": 0, "flagged": 0, "approved": 0},
        "instagram": {"total": 0, "flagged": 0, "approved": 0},
        "manual": {"total": 0, "flagged": 0, "approved": 0},
        "csv_upload": {"total": 0, "flagged": 0, "approved": 0},
    }

    historical_other_total = 0

    for row in rows:
        raw_p = (row[0] or "manual").lower().strip()
        if raw_p in ("instagram", "ig"):
            p_name = "instagram"
        elif raw_p in ("csv", "csv_upload", "batch_file"):
            p_name = "csv_upload"
        elif raw_p == "youtube":
            p_name = "youtube"
        elif raw_p == "manual":
            p_name = "manual"
        else:
            # Safely account for any historical records (such as legacy x/twitter)
            historical_other_total += int(row[1] or 0)
            continue

        platforms[p_name]["total"] += int(row[1] or 0)
        platforms[p_name]["flagged"] += int(row[2] or 0)
        platforms[p_name]["approved"] += int(row[3] or 0)

    total_social = platforms["youtube"]["total"] + platforms["instagram"]["total"] + historical_other_total

    return {
        "platforms": platforms,
        "total_social_records": total_social,
    }
