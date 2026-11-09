"""
Tests for Google Sign-In Authentication and Route Protection in CyberTech AI.
Covers:
  - Cryptographic token verification error handling
  - Unverified email rejection
  - Auto-provisioning of new Google users
  - Account linking for existing users
  - Internal JWT session issuance and access
  - Route protection
"""
import pytest
import uuid
from unittest.mock import patch, MagicMock
from httpx import AsyncClient, ASGITransport

from main import app
from app.core.database import create_tables
from app.models.user import User


@pytest.fixture(autouse=True)
async def init_db():
    await create_tables()


@pytest.mark.asyncio
async def test_google_auth_missing_credential():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Pydantic validates min_length=10
        resp = await client.post("/api/auth/google", json={"credential": "short"})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_google_auth_invalid_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Invalid token triggers ValueError in id_token.verify_oauth2_token -> 401
        resp = await client.post("/api/auth/google", json={"credential": "invalid_jwt_format_token_value_sample"})
        assert resp.status_code == 401
        assert "Google ID token verification failed" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_google_auth_unverified_email():
    mock_id_info = {
        "iss": "https://accounts.google.com",
        "sub": "google-user-12345",
        "email": "unverified@example.com",
        "email_verified": False,
        "name": "Unverified User",
    }
    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=mock_id_info):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/auth/google", json={"credential": "mock_valid_looking_token_1234567890"})
            assert resp.status_code == 401
            assert "not verified" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_google_auth_invalid_issuer():
    mock_id_info = {
        "iss": "https://attacker-domain.com",
        "sub": "attacker-user-12345",
        "email": "attacker@example.com",
        "email_verified": True,
        "name": "Attacker",
    }
    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=mock_id_info):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/auth/google", json={"credential": "mock_valid_looking_token_1234567890"})
            assert resp.status_code == 401
            assert "Invalid token issuer" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_google_auth_success_new_user():
    uid = uuid.uuid4().hex[:8]
    test_sub = f"google-sub-{uid}"
    test_email = f"new_moderator_{uid}@cybertech.ai"
    test_name = "Dr. Rajesh Kumar"
    mock_id_info = {
        "iss": "accounts.google.com",
        "sub": test_sub,
        "email": test_email,
        "email_verified": True,
        "name": test_name,
    }

    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=mock_id_info):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/auth/google", json={"credential": "mock_valid_token_xyz_9876543210"})
            assert resp.status_code == 200
            data = resp.json()
            assert "access_token" in data
            assert data["token_type"] == "bearer"
            assert data["user"]["email"] == test_email
            assert data["user"]["name"] == test_name
            assert data["user"]["auth_provider"] == "google"
            assert data["user"]["role"] == "moderator"

            # Verify session token works with protected /api/auth/me
            token = data["access_token"]
            me_resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
            assert me_resp.status_code == 200
            assert me_resp.json()["email"] == test_email


@pytest.mark.asyncio
async def test_google_auth_existing_user_linking():
    uid = uuid.uuid4().hex[:8]
    test_email = f"linking_user_{uid}@cybertech.ai"
    test_sub = f"google-sub-linked-{uid}"

    # 1. Register with email & password first
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        reg_resp = await client.post("/api/auth/register", json={
            "email": test_email,
            "password": "Password123!",
            "name": "Local Account User",
            "preferred_language": "en"
        })
        assert reg_resp.status_code == 201

    # 2. Authenticate with Google using same email
    mock_id_info = {
        "iss": "https://accounts.google.com",
        "sub": test_sub,
        "email": test_email,
        "email_verified": True,
        "name": "Local Account User",
    }
    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=mock_id_info):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/auth/google", json={"credential": "mock_token_for_linking_test_123456789"})
            assert resp.status_code == 200
            data = resp.json()
            assert data["user"]["email"] == test_email
            assert "access_token" in data
