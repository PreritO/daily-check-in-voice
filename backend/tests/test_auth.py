"""Integration tests for authentication middleware."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.main import app


class TestAuthMiddleware:
    """Tests for authentication middleware behavior."""

    @pytest.fixture
    async def unauthenticated_client(self, test_session: AsyncSession) -> AsyncClient:
        """Create a client without auth mock (tests real auth flow)."""

        async def override_get_db():
            try:
                yield test_session
                await test_session.commit()
            except Exception:
                await test_session.rollback()
                raise

        app.dependency_overrides[get_db] = override_get_db

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as ac:
            yield ac

        app.dependency_overrides.clear()

    async def test_protected_endpoint_without_token(
        self, unauthenticated_client: AsyncClient
    ) -> None:
        """Test that protected endpoints return 401 without auth header."""
        # GET /api/users/me requires authentication
        response = await unauthenticated_client.get("/api/users/me")
        assert response.status_code == 401

    async def test_protected_endpoint_with_invalid_token(
        self, unauthenticated_client: AsyncClient
    ) -> None:
        """Test that protected endpoints return 401 with invalid token."""
        headers = {"Authorization": "Bearer invalid-token-12345"}
        response = await unauthenticated_client.get("/api/users/me", headers=headers)
        assert response.status_code == 401

    async def test_protected_endpoint_with_malformed_header(
        self, unauthenticated_client: AsyncClient
    ) -> None:
        """Test that malformed Authorization header returns 401."""
        # Missing "Bearer" prefix
        headers = {"Authorization": "invalid-token-12345"}
        response = await unauthenticated_client.get("/api/users/me", headers=headers)
        # FastAPI's HTTPBearer returns 403 for invalid format
        assert response.status_code in [401, 403]

    async def test_protected_endpoint_with_valid_token(
        self, authenticated_client: AsyncClient
    ) -> None:
        """Test that authenticated client can access protected endpoints."""
        response = await authenticated_client.get("/api/users/me")
        assert response.status_code == 200
        user = response.json()
        assert "id" in user
        assert "email" in user

    async def test_analytics_endpoint_requires_auth(
        self, unauthenticated_client: AsyncClient
    ) -> None:
        """Test that analytics endpoint requires authentication."""
        response = await unauthenticated_client.get("/api/users/me/analytics")
        assert response.status_code == 401

    async def test_preferences_endpoints_require_auth(
        self, unauthenticated_client: AsyncClient
    ) -> None:
        """Test that preferences endpoints require authentication."""
        # GET
        response = await unauthenticated_client.get("/api/preferences")
        assert response.status_code == 401

        # PUT
        response = await unauthenticated_client.put(
            "/api/preferences",
            json={"communication_style": "casual"},
        )
        assert response.status_code == 401

        # DELETE
        response = await unauthenticated_client.delete("/api/preferences")
        assert response.status_code == 401

    async def test_alerts_endpoint_requires_auth(self, unauthenticated_client: AsyncClient) -> None:
        """Test that alerts endpoint requires authentication."""
        response = await unauthenticated_client.get("/api/alerts/")
        assert response.status_code == 401
