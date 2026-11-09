"""
Database models for feedback, error analysis, evaluation, datasets, and audit.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Float, Boolean, Text, Integer, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class FeedbackRecord(Base):
    """Human feedback on model predictions for error analysis."""
    __tablename__ = "feedback_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    record_id: Mapped[str] = mapped_column(String(36), ForeignKey("moderation_records.id"), nullable=True)
    
    # Prediction vs ground truth
    predicted_labels: Mapped[dict] = mapped_column(JSON, nullable=True)
    corrected_labels: Mapped[dict] = mapped_column(JSON, nullable=True)
    predicted_severity: Mapped[str] = mapped_column(String(20), nullable=True)
    corrected_severity: Mapped[str] = mapped_column(String(20), nullable=True)
    
    # Error type
    is_false_positive: Mapped[bool] = mapped_column(Boolean, default=False)
    is_false_negative: Mapped[bool] = mapped_column(Boolean, default=False)
    is_ambiguous: Mapped[bool] = mapped_column(Boolean, default=False)
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    
    explanation: Mapped[str] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(50), nullable=True)
    model_version: Mapped[str] = mapped_column(String(50), nullable=True)
    reviewer_id: Mapped[str] = mapped_column(String(100), default="moderator_1")
    
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Validation status
    validation_status: Mapped[str] = mapped_column(String(30), default="pending")  # pending/validated/rejected
    validated_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    record: Mapped["app.models.moderation.ModerationRecord"] = relationship(
        "ModerationRecord", back_populates="feedback"
    )


class EvaluationRun(Base):
    """Stores evaluation run results and configuration."""
    __tablename__ = "evaluation_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    run_name: Mapped[str] = mapped_column(String(200), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    dataset_name: Mapped[str] = mapped_column(String(200), nullable=True)
    dataset_version: Mapped[str] = mapped_column(String(50), nullable=True)
    
    # Metrics (JSON for flexibility)
    overall_metrics: Mapped[dict] = mapped_column(JSON, nullable=True)
    per_label_metrics: Mapped[dict] = mapped_column(JSON, nullable=True)
    per_language_metrics: Mapped[dict] = mapped_column(JSON, nullable=True)
    confusion_matrix: Mapped[dict] = mapped_column(JSON, nullable=True)
    threshold_config: Mapped[dict] = mapped_column(JSON, nullable=True)
    
    total_samples: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="completed")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DatasetRecord(Base):
    """Metadata for imported datasets."""
    __tablename__ = "dataset_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    version: Mapped[str] = mapped_column(String(50), default="1.0.0")
    source: Mapped[str] = mapped_column(String(500), nullable=True)
    license_info: Mapped[str] = mapped_column(Text, nullable=True)
    permitted_use: Mapped[str] = mapped_column(Text, nullable=True)
    
    total_records: Mapped[int] = mapped_column(Integer, default=0)
    train_count: Mapped[int] = mapped_column(Integer, default=0)
    val_count: Mapped[int] = mapped_column(Integer, default=0)
    test_count: Mapped[int] = mapped_column(Integer, default=0)
    
    label_distribution: Mapped[dict] = mapped_column(JSON, nullable=True)
    language_distribution: Mapped[dict] = mapped_column(JSON, nullable=True)
    missing_values: Mapped[int] = mapped_column(Integer, default=0)
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0)
    
    status: Mapped[str] = mapped_column(String(30), default="imported")  # uploaded/validated/imported/error
    validation_errors: Mapped[dict] = mapped_column(JSON, nullable=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DatasetRun(Base):
    """Stores batch detection runs on datasets."""
    __tablename__ = "dataset_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    dataset_name: Mapped[str] = mapped_column(String(200), nullable=False)
    dataset_id: Mapped[str] = mapped_column(String(36), nullable=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="completed")  # running/completed/failed
    total_samples: Mapped[int] = mapped_column(Integer, default=0)
    processed_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    flagged_count: Mapped[int] = mapped_column(Integer, default=0)
    approved_count: Mapped[int] = mapped_column(Integer, default=0)
    language_breakdown: Mapped[dict] = mapped_column(JSON, nullable=True)
    severity_breakdown: Mapped[dict] = mapped_column(JSON, nullable=True)
    processing_time_ms: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditEvent(Base):
    """Audit trail for all consequential system actions."""
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    record_id: Mapped[str] = mapped_column(String(36), ForeignKey("moderation_records.id"), nullable=True)
    
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(100), nullable=True)
    actor_name: Mapped[str] = mapped_column(String(200), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str] = mapped_column(String(50), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    record: Mapped["app.models.moderation.ModerationRecord"] = relationship(
        "ModerationRecord", back_populates="audit_events"
    )
