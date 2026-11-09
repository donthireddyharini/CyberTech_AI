"""Database setup using SQLAlchemy async with SQLite."""
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def create_tables():
    """Create all database tables and ensure column migrations."""
    from app.models import moderation, evaluation, feedback, dataset, audit, user, social, chat_session  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def migrate_sqlite_columns(connection):
            # Check and add new columns for complete account-wise data isolation
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
                    pass  # Column already exists
        await conn.run_sync(migrate_sqlite_columns)


async def get_db():
    """Dependency injection for database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
