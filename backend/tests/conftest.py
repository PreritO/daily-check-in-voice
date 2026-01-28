"""Pytest fixtures for backend tests."""

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI app."""
    return TestClient(app)


# TODO: Add async database fixtures
# @pytest.fixture
# async def db_session():
#     """Create a test database session."""
#     pass
