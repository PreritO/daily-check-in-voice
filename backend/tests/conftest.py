"""Pytest fixtures for backend tests."""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.database import get_db
from src.main import app
from src.models import Base, Call, CallStatus, Schedule, User


def _gen_random_uuid() -> str:
    """Generate a random UUID as a hex string for SQLite compatibility."""
    return uuid.uuid4().hex


def _now() -> str:
    """Generate current timestamp in ISO format for SQLite compatibility."""
    from datetime import datetime

    return datetime.now(UTC).isoformat()


# =============================================================================
# Database fixtures
# =============================================================================


@pytest.fixture
async def test_engine():
    """Create an in-memory SQLite async engine for testing."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    # Register custom functions for SQLite to mimic PostgreSQL functions
    @event.listens_for(engine.sync_engine, "connect")
    def register_functions(dbapi_connection, connection_record):
        dbapi_connection.create_function("gen_random_uuid", 0, _gen_random_uuid)
        dbapi_connection.create_function("now", 0, _now)

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Drop all tables after test
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def test_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create an async session for testing."""
    session_maker = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with session_maker() as session:
        yield session


@pytest.fixture
async def client(test_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create an async HTTP client with database dependency override."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
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


# =============================================================================
# Factory fixtures for test data
# =============================================================================


@pytest.fixture
async def test_user(test_session: AsyncSession) -> User:
    """Create a test user."""
    user = User(
        id=uuid.uuid4(),
        email="testuser@example.com",
        name="Test User",
        timezone="America/New_York",
        phone_number="+1234567890",
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest.fixture
async def test_user_2(test_session: AsyncSession) -> User:
    """Create a second test user."""
    user = User(
        id=uuid.uuid4(),
        email="another@example.com",
        name="Another User",
        timezone="UTC",
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest.fixture
async def test_call(test_session: AsyncSession, test_user: User) -> Call:
    """Create a test call."""
    call = Call(
        id=uuid.uuid4(),
        user_id=test_user.id,
        status=CallStatus.SCHEDULED,
    )
    test_session.add(call)
    await test_session.commit()
    await test_session.refresh(call)
    return call


@pytest.fixture
async def test_schedule(test_session: AsyncSession, test_user: User) -> Schedule:
    """Create a test schedule."""
    schedule = Schedule(
        id=uuid.uuid4(),
        user_id=test_user.id,
        cron_expression="0 9 * * 1-5",
        enabled=True,
    )
    test_session.add(schedule)
    await test_session.commit()
    await test_session.refresh(schedule)
    return schedule
