"""Pytest configuration and global test fixtures for Sentinel AI Backend."""
import os
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_sentinel.db"
os.environ["DEMO_MODE"] = "false"

from main import app
from app.core.database import get_db, Base, engine, create_tables

TEST_DB_URL = "sqlite+aiosqlite:///./test_sentinel.db"
test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Create all tables and required columns on both test_engine and default engine."""
    from app.models import moderation, evaluation, feedback, dataset, audit, user, social, chat_session  # noqa: F401
    
    for eng in (test_engine, engine):
        async with eng.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
            def migrate_cols(connection):
                cols_to_add = [
                    ("moderation_records", "user_id VARCHAR(36)"),
                    ("feedback_records", "user_id VARCHAR(36)"),
                    ("dataset_records", "user_id VARCHAR(36)"),
                    ("dataset_runs", "user_id VARCHAR(36)"),
                    ("social_sync_logs", "user_id VARCHAR(36)"),
                    ("chat_sessions", "user_id VARCHAR(36)"),
                    ("moderation_records", "source_url VARCHAR(500)"),
                    ("moderation_records", "author_name VARCHAR(200)"),
                    ("moderation_records", "author_id VARCHAR(200)"),
                    ("moderation_records", "parent_comment_id VARCHAR(200)"),
                    ("users", "auth_provider VARCHAR(50) DEFAULT 'local'"),
                    ("users", "google_id VARCHAR(100)"),
                ]
                for table, col in cols_to_add:
                    try:
                        connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {col}"))
                    except Exception:
                        pass
            await conn.run_sync(migrate_cols)
    
    await create_tables()
