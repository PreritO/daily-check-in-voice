"""Integration tests for mood analysis endpoint."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Call, CallStatus, MoodAnalysis, SentimentType, Speaker, Transcript, User
from src.services.mood_service import MoodAnalysisResult


class TestMoodAnalysisAPI:
    """Tests for POST /api/calls/{id}/analyze-mood endpoint."""

    @pytest.fixture
    async def test_call_with_transcripts(self, test_session: AsyncSession, test_user: User) -> Call:
        """Create a test call with transcripts."""
        call = Call(
            id=uuid.uuid4(),
            user_id=test_user.id,
            status=CallStatus.COMPLETED,
        )
        test_session.add(call)
        await test_session.flush()

        # Add transcripts
        transcripts = [
            Transcript(
                call_id=call.id,
                speaker=Speaker.AGENT,
                content="How are you feeling today?",
                timestamp_ms=0,
            ),
            Transcript(
                call_id=call.id,
                speaker=Speaker.USER,
                content="I'm doing well, thank you!",
                timestamp_ms=2000,
            ),
        ]
        for t in transcripts:
            test_session.add(t)

        await test_session.commit()
        await test_session.refresh(call)
        return call

    @pytest.fixture
    async def test_call_no_transcripts(self, test_session: AsyncSession, test_user: User) -> Call:
        """Create a test call without transcripts."""
        call = Call(
            id=uuid.uuid4(),
            user_id=test_user.id,
            status=CallStatus.COMPLETED,
        )
        test_session.add(call)
        await test_session.commit()
        await test_session.refresh(call)
        return call

    @pytest.fixture
    async def test_call_with_mood(self, test_session: AsyncSession, test_user: User) -> Call:
        """Create a test call that already has mood analysis."""
        call = Call(
            id=uuid.uuid4(),
            user_id=test_user.id,
            status=CallStatus.COMPLETED,
        )
        test_session.add(call)
        await test_session.flush()

        # Add transcript
        transcript = Transcript(
            call_id=call.id,
            speaker=Speaker.USER,
            content="Hello",
            timestamp_ms=0,
        )
        test_session.add(transcript)

        # Add mood analysis
        mood = MoodAnalysis(
            call_id=call.id,
            overall_sentiment=SentimentType.POSITIVE,
            confidence=0.9,
            flags=[],
            notes="Already analyzed",
        )
        test_session.add(mood)

        await test_session.commit()
        await test_session.refresh(call)
        return call

    @patch("src.api.routes.calls.analyze_mood")
    async def test_analyze_mood_success(
        self,
        mock_analyze_mood: AsyncMock,
        authenticated_client: AsyncClient,
        test_call_with_transcripts: Call,
    ) -> None:
        """Test successful mood analysis."""
        # Mock the analyze_mood service
        mock_analyze_mood.return_value = MoodAnalysisResult(
            overall_sentiment=SentimentType.POSITIVE,
            confidence=0.85,
            flags=[],
            notes="User seems happy",
        )

        response = await authenticated_client.post(
            f"/api/calls/{test_call_with_transcripts.id}/analyze-mood"
        )
        assert response.status_code == 201
        data = response.json()
        assert data["overall_sentiment"] == "positive"
        assert data["confidence"] == 0.85
        assert data["flags"] == []
        assert data["notes"] == "User seems happy"
        assert "id" in data
        assert "analyzed_at" in data

    async def test_analyze_mood_call_not_found(self, authenticated_client: AsyncClient) -> None:
        """Test mood analysis for non-existent call returns 404."""
        fake_id = uuid.uuid4()
        response = await authenticated_client.post(f"/api/calls/{fake_id}/analyze-mood")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    async def test_analyze_mood_no_transcripts(
        self, authenticated_client: AsyncClient, test_call_no_transcripts: Call
    ) -> None:
        """Test mood analysis without transcripts returns 400."""
        response = await authenticated_client.post(
            f"/api/calls/{test_call_no_transcripts.id}/analyze-mood"
        )
        assert response.status_code == 400
        assert "transcripts" in response.json()["detail"].lower()

    async def test_analyze_mood_already_analyzed(
        self, authenticated_client: AsyncClient, test_call_with_mood: Call
    ) -> None:
        """Test mood analysis when already exists returns 409."""
        response = await authenticated_client.post(
            f"/api/calls/{test_call_with_mood.id}/analyze-mood"
        )
        assert response.status_code == 409
        assert "already" in response.json()["detail"].lower()

    @patch("src.api.routes.calls.analyze_mood")
    async def test_analyze_mood_with_flags(
        self,
        mock_analyze_mood: AsyncMock,
        authenticated_client: AsyncClient,
        test_call_with_transcripts: Call,
    ) -> None:
        """Test mood analysis with concern flags."""
        mock_analyze_mood.return_value = MoodAnalysisResult(
            overall_sentiment=SentimentType.CONCERNED,
            confidence=0.75,
            flags=["confusion", "loneliness"],
            notes="User mentioned feeling isolated",
        )

        response = await authenticated_client.post(
            f"/api/calls/{test_call_with_transcripts.id}/analyze-mood"
        )
        assert response.status_code == 201
        data = response.json()
        assert data["overall_sentiment"] == "concerned"
        assert data["flags"] == ["confusion", "loneliness"]

    @patch("src.api.routes.calls.analyze_mood")
    async def test_analyze_mood_service_error(
        self,
        mock_analyze_mood: AsyncMock,
        authenticated_client: AsyncClient,
        test_call_with_transcripts: Call,
    ) -> None:
        """Test mood analysis when service raises error returns 500."""
        # The route catches ValueError specifically
        mock_analyze_mood.side_effect = ValueError("Claude API error")

        response = await authenticated_client.post(
            f"/api/calls/{test_call_with_transcripts.id}/analyze-mood"
        )
        assert response.status_code == 500
        assert "Claude API error" in response.json()["detail"]
