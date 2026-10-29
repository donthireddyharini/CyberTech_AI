"""
Base connector specifications and normalized data structures for CyberTech AI social integrations.
Strict security: Never logs or exposes credentials.
"""
import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
import httpx

logger = logging.getLogger(__name__)


@dataclass
class NormalizedSocialComment:
    """Standardized representation of a comment across all platforms."""
    platform: str  # 'youtube', 'instagram'
    comment_id: str  # Platform unique comment/post ID
    text: str
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    published_at: Optional[datetime] = None
    source_url: Optional[str] = None
    parent_id: Optional[str] = None  # None if top-level, or parent comment ID for replies
    target_id: Optional[str] = None  # Video ID, Instagram Media ID
    raw_metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ConnectorStatus:
    """Current operational and connectivity status of an API connector."""
    platform: str
    is_configured: bool
    status: str  # 'ready', 'unconfigured', 'rate_limited', 'error'
    message: str
    last_sync_timestamp: Optional[str] = None
    account_info: Optional[str] = None
    rate_limit_info: Optional[Dict[str, Any]] = None


class BaseSocialConnector(ABC):
    """Abstract base class for official social platform connectors."""

    def __init__(self, platform_name: str):
        self.platform_name = platform_name
        self.last_sync_timestamp: Optional[str] = None
        self._runtime_credential: Optional[str] = None

    def set_runtime_credential(self, cred: Optional[str]):
        """Allows setting a session/request-scoped credential securely."""
        self._runtime_credential = cred.strip() if cred else None

    @abstractmethod
    def get_credential(self) -> Optional[str]:
        """Retrieve the active credential (runtime override or environment setting)."""
        pass

    @abstractmethod
    async def check_connection(self) -> ConnectorStatus:
        """Verify connectivity and authentication with the official API."""
        pass

    async def _request_with_retry(
        self,
        client: httpx.AsyncClient,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        max_retries: int = 3,
        base_backoff_sec: float = 1.0,
    ) -> httpx.Response:
        """
        Executes an HTTP request with exponential backoff on transient errors (429, 500, 502, 503, 504).
        Never prints headers or sensitive tokens in log output.
        """
        attempt = 0
        while True:
            attempt += 1
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json_data,
                    timeout=20.0
                )
                # Rate limit (429) or transient server errors (500, 502, 503, 504)
                if response.status_code in (429, 500, 502, 503, 504) and attempt <= max_retries:
                    retry_after = response.headers.get("Retry-After")
                    sleep_time = float(retry_after) if retry_after and retry_after.isdigit() else (base_backoff_sec * (2 ** (attempt - 1)))
                    logger.warning(
                        f"[{self.platform_name}] Transient status {response.status_code}. Retrying in {sleep_time:.1f}s (Attempt {attempt}/{max_retries})."
                    )
                    await asyncio.sleep(sleep_time)
                    continue

                return response
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                if attempt <= max_retries:
                    sleep_time = base_backoff_sec * (2 ** (attempt - 1))
                    logger.warning(
                        f"[{self.platform_name}] Network error: {type(exc).__name__}. Retrying in {sleep_time:.1f}s (Attempt {attempt}/{max_retries})."
                    )
                    await asyncio.sleep(sleep_time)
                    continue
                raise
