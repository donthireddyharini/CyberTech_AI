"""Application configuration using pydantic-settings."""
import os
from typing import Optional
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


_backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_root_dir = os.path.dirname(_backend_dir)
_env_files = (
    os.path.join(_backend_dir, ".env"),
    os.path.join(_root_dir, ".env"),
    ".env",
    "sentinel-backend/.env",
)


_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DB_PATH = os.path.join(_BACKEND_DIR, "sentinel.db").replace("\\", "/")


class Settings(BaseSettings):
    DATABASE_URL: str = f"sqlite+aiosqlite:///{_DB_PATH}"
    SECRET_KEY: str = "sentinel-dev-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    MODEL_NAME: str = "baseline"
    MODEL_VERSION: str = "1.0.0"
    DEMO_MODE: bool = True
    LOG_LEVEL: str = "INFO"
    APP_TIMEZONE: str = "UTC"

    # Centralized Server-Side Social Media API Credentials
    YOUTUBE_API_KEY: Optional[str] = None
    INSTAGRAM_ACCESS_TOKEN: Optional[str] = None
    INSTAGRAM_ACCOUNT_ID: Optional[str] = None
    INSTAGRAM_APP_SECRET: Optional[str] = None

    # Google Sign-In OAuth Configuration
    GOOGLE_CLIENT_ID: Optional[str] = "883218263318-89148rbi3f69lmc28mrchja5vdhltp27.apps.googleusercontent.com"
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    @property
    def clean_youtube_api_key(self) -> Optional[str]:
        if self.YOUTUBE_API_KEY and isinstance(self.YOUTUBE_API_KEY, str) and self.YOUTUBE_API_KEY.strip():
            return self.YOUTUBE_API_KEY.strip()
        return None

    @property
    def clean_instagram_access_token(self) -> Optional[str]:
        if self.INSTAGRAM_ACCESS_TOKEN and isinstance(self.INSTAGRAM_ACCESS_TOKEN, str) and self.INSTAGRAM_ACCESS_TOKEN.strip():
            return self.INSTAGRAM_ACCESS_TOKEN.strip()
        return None

    @property
    def clean_google_client_id(self) -> Optional[str]:
        if self.GOOGLE_CLIENT_ID and isinstance(self.GOOGLE_CLIENT_ID, str) and self.GOOGLE_CLIENT_ID.strip():
            return self.GOOGLE_CLIENT_ID.strip()
        return None

    @property
    def clean_google_client_secret(self) -> Optional[str]:
        if self.GOOGLE_CLIENT_SECRET and isinstance(self.GOOGLE_CLIENT_SECRET, str) and self.GOOGLE_CLIENT_SECRET.strip():
            return self.GOOGLE_CLIENT_SECRET.strip()
        return None

    model_config = SettingsConfigDict(env_file=_env_files, env_file_encoding="utf-8", extra="ignore")


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
