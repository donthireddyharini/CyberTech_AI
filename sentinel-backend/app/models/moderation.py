"""
Database models for Sentinel AI.
Moderation records, model outputs, human reviews, audit trail.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Float, Boolean, Text, Integer, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class ModerationRecord(Base):
    """Stores every analyzed comment with model outputs."""
    __tablename__ = "moderation_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_text: Mapped[str] = mapped_column(Text, nullable=True)
    context_before: Mapped[str] = mapped_column(Text, nullable=True)
    context_after: Mapped[str] = mapped_column(Text, nullable=True)

    # Model outputs
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    labels: Mapped[dict] = mapped_column(JSON, nullable=False, default=list)
    hate_speech_score: Mapped[float] = mapped_column(Float, default=0.0)
    harassment_score: Mapped[float] = mapped_column(Float, default=0.0)
    cyberbullying_score: Mapped[float] = mapped_column(Float, default=0.0)
    legitimate_score: Mapped[float] = mapped_column(Float, default=0.0)
    
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # low/medium/high/uncertain
    severity_reason: Mapped[str] = mapped_column(Text, nullable=True)
    decision: Mapped[str] = mapped_column(String(50), nullable=False)
    confidence_level: Mapped[str] = mapped_column(String(20), nullable=True)
    recommended_action: Mapped[str] = mapped_column(Text, nullable=True)
    ambiguity_warning: Mapped[str] = mapped_column(Text, nullable=True)

    # Language
    detected_language: Mapped[str] = mapped_column(String(50), nullable=True)
    is_code_mixed: Mapped[bool] = mapped_column(Boolean, default=False)
    language_hint: Mapped[str] = mapped_column(String(50), nullable=True)

    # Moderation status
    status: Mapped[str] = mapped_column(String(30), default="pending")  # pending/reviewed/escalated/dismissed
    platform: Mapped[str] = mapped_column(String(100), nullable=True)
    source_id: Mapped[str] = mapped_column(String(200), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    inference_timestamp: Mapped[float] = mapped_column(Float, nullable=True)
    processing_time_ms: Mapped[float] = mapped_column(Float, nullable=True)

    # Relationships
    reviews: Mapped[list["HumanReview"]] = relationship("HumanReview", back_populates="record", cascade="all, delete-orphan")
    feedback: Mapped[list["FeedbackRecord"]] = relationship("FeedbackRecord", back_populates="record", cascade="all, delete-orphan")
    audit_events: Mapped[list["AuditEvent"]] = relationship("AuditEvent", back_populates="record", cascade="all, delete-orphan")


class HumanReview(Base):
    """Stores human moderator decisions and overrides."""
    __tablename__ = "human_reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    record_id: Mapped[str] = mapped_column(String(36), ForeignKey("moderation_records.id"), nullable=False)
    
    # Decision
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # approve/dismiss/escalate/further_review
    corrected_labels: Mapped[dict] = mapped_column(JSON, nullable=True)
    corrected_severity: Mapped[str] = mapped_column(String(20), nullable=True)
    reviewer_notes: Mapped[str] = mapped_column(Text, nullable=True)
    override_reason: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Reviewer identity
    reviewer_id: Mapped[str] = mapped_column(String(100), default="moderator_1")
    reviewer_name: Mapped[str] = mapped_column(String(200), default="Moderator")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    record: Mapped["ModerationRecord"] = relationship("ModerationRecord", back_populates="reviews")
