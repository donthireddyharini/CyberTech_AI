"""
Connector Manager for CyberTech AI.
Coordinates platform connectors, credential overrides, and health diagnostics.
"""
import logging
from typing import Dict, Any, Optional, List
from app.connectors.base import BaseSocialConnector, ConnectorStatus
from app.connectors.youtube import YouTubeConnector
from app.connectors.instagram import InstagramConnector

logger = logging.getLogger(__name__)


class ConnectorManager:
    """Singleton manager controlling active social media connectors."""

    def __init__(self):
        self._connectors: Dict[str, BaseSocialConnector] = {
            "youtube": YouTubeConnector(),
            "instagram": InstagramConnector(),
        }

    def get_connector(self, platform: str) -> BaseSocialConnector:
        platform_key = platform.lower().strip()
        if platform_key in ("instagram", "ig"):
            platform_key = "instagram"
        connector = self._connectors.get(platform_key)
        if not connector:
            raise ValueError(f"Unsupported social platform '{platform}'. Supported: youtube, instagram.")
        return connector

    def set_runtime_credentials(self, platform: str, credentials: Dict[str, str]):
        """Sets in-memory runtime credentials without exposing them in logs."""
        platform_key = platform.lower().strip()
        if platform_key in ("instagram", "ig"):
            platform_key = "instagram"

        connector = self.get_connector(platform_key)
        if platform_key == "youtube":
            connector.set_runtime_credential(credentials.get("api_key"))
        elif platform_key == "instagram":
            connector.set_runtime_credential(credentials.get("access_token"))

    async def get_all_statuses(self) -> List[ConnectorStatus]:
        """Runs parallel or sequential health checks across all configured connectors."""
        statuses = []
        for name, connector in self._connectors.items():
            try:
                status = await connector.check_connection()
                statuses.append(status)
            except Exception as e:
                logger.error(f"Error checking connector {name}: {e}")
                statuses.append(ConnectorStatus(
                    platform=name,
                    is_configured=bool(connector.get_credential()),
                    status="error",
                    message=f"Health check failed: {str(e)}",
                    last_sync_timestamp=connector.last_sync_timestamp
                ))
        return statuses


_manager_instance: Optional[ConnectorManager] = None


def get_connector_manager() -> ConnectorManager:
    """Returns the singleton instance of ConnectorManager."""
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = ConnectorManager()
    return _manager_instance
