"""
Social media sync log model for tracking YouTube and Instagram synchronization runs.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class SocialSyncLog(Base):
    """Tracks synchronization runs from social media platforms."""
    __tablename__ = "social_sync_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    platform: Mapped[str] = mapped_column(String(50), nullable=False)  # youtube, instagram
    target_input: Mapped[str] = mapped_column(String(500), nullable=False)  # video URL/ID, search query, media ID
    total_fetched: Mapped[int] = mapped_column(Integer, default=0)
    newly_ingested: Mapped[int] = mapped_column(Integer, default=0)
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0)
    flagged_count: Mapped[int] = mapped_column(Integer, default=0)
    approved_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="completed")  # completed, failed, partial
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    processing_time_ms: Mapped[float] = mapped_column(Float, default=0.0)

    # User scoping
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
