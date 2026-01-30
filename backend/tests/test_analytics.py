"""Integration tests for analytics endpoint."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Call, CallStatus, MoodAnalysis, SentimentType, User


class TestAnalyticsAPI:
    """Tests for GET /api/users/me/analytics endpoint."""

    async def test_analytics_empty(
        self, authenticated_client: AsyncClient, test_user: User
    ) -> None:
        """Test analytics for user with no calls."""
        response = await authenticated_client.get("/api/users/me/analytics")
        assert response.status_code == 200
        data = response.json()
        assert data["total_calls"] == 0
        assert data["total_duration_minutes"] == 0.0
        assert data["average_call_duration"] == 0.0
        assert data["calls_this_week"] == 0
        assert data["calls_this_month"] == 0
        assert data["mood_trend"] == []
        assert data["streak_days"] == 0

    async def test_analytics_with_calls(
        self, authenticated_client: AsyncClient, test_user: User, test_session: AsyncSession
    ) -> None:
        """Test analytics with completed calls."""
        now = datetime.now(UTC)

        # Create completed calls
        calls = [
            Call(
                id=uuid.uuid4(),
                user_id=test_user.id,
                status=CallStatus.COMPLETED,
                started_at=now - timedelta(hours=2),
                ended_at=now - timedelta(hours=1, minutes=45),  # 15 min call
            ),
            Call(
                id=uuid.uuid4(),
                user_id=test_user.id,
                status=CallStatus.COMPLETED,
                started_at=now - timedelta(hours=1),
                ended_at=now - timedelta(minutes=30),  # 30 min call
            ),
        ]
        for call in calls:
            test_session.add(call)
        await test_session.commit()

        response = await authenticated_client.get("/api/users/me/analytics")
        assert response.status_code == 200
        data = response.json()
        assert data["total_calls"] == 2
        assert data["total_duration_minutes"] == pytest.approx(45.0, rel=0.1)
        assert data["average_call_duration"] == pytest.approx(22.5, rel=0.1)
        assert data["calls_this_week"] == 2
        assert data["calls_this_month"] == 2

    async def test_analytics_with_mood_trend(
        self, authenticated_client: AsyncClient, test_user: User, test_session: AsyncSession
    ) -> None:
        """Test analytics includes mood trend data."""
        now = datetime.now(UTC)

        # Create calls with mood analysis
        sentiments = [SentimentType.POSITIVE, SentimentType.NEUTRAL, SentimentType.CONCERNED]
        for i, sentiment in enumerate(sentiments):
            call = Call(
                id=uuid.uuid4(),
                user_id=test_user.id,
                status=CallStatus.COMPLETED,
                started_at=now - timedelta(days=i),
                ended_at=now - timedelta(days=i) + timedelta(minutes=10),
            )
            test_session.add(call)
            await test_session.flush()

            mood = MoodAnalysis(
                call_id=call.id,
                overall_sentiment=sentiment,
                confidence=0.8,
                flags=[],
            )
            test_session.add(mood)

        await test_session.commit()

        response = await authenticated_client.get("/api/users/me/analytics")
        assert response.status_code == 200
        data = response.json()
        assert data["total_calls"] == 3
        assert len(data["mood_trend"]) == 3

        # Verify mood trend structure
        for item in data["mood_trend"]:
            assert "call_date" in item
            assert "sentiment" in item
            assert "confidence" in item
            assert item["sentiment"] in ["positive", "neutral", "negative", "concerned"]

    async def test_analytics_streak_calculation(
        self, authenticated_client: AsyncClient, test_user: User, test_session: AsyncSession
    ) -> None:
        """Test streak calculation with consecutive days."""
        now = datetime.now(UTC)

        # Create calls for today and yesterday (2-day streak)
        for days_ago in [0, 1]:
            call = Call(
                id=uuid.uuid4(),
                user_id=test_user.id,
                status=CallStatus.COMPLETED,
                started_at=now - timedelta(days=days_ago, hours=2),
                ended_at=now - timedelta(days=days_ago, hours=1),
            )
            test_session.add(call)
        await test_session.commit()

        response = await authenticated_client.get("/api/users/me/analytics")
        assert response.status_code == 200
        data = response.json()
        assert data["streak_days"] >= 1  # At least 1 (today's call)

    async def test_analytics_only_completed_calls(
        self, authenticated_client: AsyncClient, test_user: User, test_session: AsyncSession
    ) -> None:
        """Test that only completed calls are counted."""
        now = datetime.now(UTC)

        # Create calls with different statuses
        statuses = [
            (CallStatus.COMPLETED, now, now + timedelta(minutes=10)),
            (CallStatus.SCHEDULED, None, None),
            (CallStatus.FAILED, now, now + timedelta(minutes=5)),
            (CallStatus.IN_PROGRESS, now, None),
        ]

        for status, started, ended in statuses:
            call = Call(
                id=uuid.uuid4(),
                user_id=test_user.id,
                status=status,
                started_at=started,
                ended_at=ended,
            )
            test_session.add(call)
        await test_session.commit()

        response = await authenticated_client.get("/api/users/me/analytics")
        assert response.status_code == 200
        data = response.json()
        assert data["total_calls"] == 1  # Only the completed call

    async def test_analytics_filters_by_user(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
        test_user_2: User,
        test_session: AsyncSession,
    ) -> None:
        """Test that analytics only includes current user's calls."""
        now = datetime.now(UTC)

        # Create call for test_user
        call1 = Call(
            id=uuid.uuid4(),
            user_id=test_user.id,
            status=CallStatus.COMPLETED,
            started_at=now - timedelta(hours=1),
            ended_at=now,
        )
        # Create call for test_user_2
        call2 = Call(
            id=uuid.uuid4(),
            user_id=test_user_2.id,
            status=CallStatus.COMPLETED,
            started_at=now - timedelta(hours=1),
            ended_at=now,
        )
        test_session.add(call1)
        test_session.add(call2)
        await test_session.commit()

        response = await authenticated_client.get("/api/users/me/analytics")
        assert response.status_code == 200
        data = response.json()
        assert data["total_calls"] == 1  # Only test_user's call
