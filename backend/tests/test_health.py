"""Tests for health check endpoints."""

from httpx import AsyncClient


async def test_health_check(client: AsyncClient) -> None:
    """Test health check endpoint returns healthy status."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


async def test_readiness_check(client: AsyncClient) -> None:
    """Test readiness check endpoint returns ready status."""
    response = await client.get("/api/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}
