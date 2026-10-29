"""User authentication and profile model."""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, default="")
    preferred_language: Mapped[str] = mapped_column(String(20), default="en")
    auth_provider: Mapped[str] = mapped_column(String(50), default="local")
    google_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    role: Mapped[str] = mapped_column(String(50), default="moderator")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
