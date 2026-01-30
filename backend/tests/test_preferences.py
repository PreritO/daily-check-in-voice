"""Integration tests for preferences endpoints."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import User
from src.models.preferences import CallDurationPreference, CommunicationStyle, UserPreferences


class TestPreferencesAPI:
    """Tests for /api/preferences endpoints."""

    async def test_get_preferences_creates_defaults(
        self, authenticated_client: AsyncClient, test_user: User
    ) -> None:
        """Test that GET creates default preferences if none exist."""
        response = await authenticated_client.get("/api/preferences")
        assert response.status_code == 200
        prefs = response.json()
        assert prefs["user_id"] == str(test_user.id)
        assert prefs["conversation_topics"] == []
        assert prefs["interests"] == []
        assert prefs["communication_style"] == "friendly"  # Default
        assert prefs["call_duration_preference"] == "medium"  # Default

    async def test_get_preferences_returns_existing(
        self, authenticated_client: AsyncClient, test_user: User, test_session: AsyncSession
    ) -> None:
        """Test that GET returns existing preferences."""
        # Create preferences first
        prefs = UserPreferences(
            user_id=test_user.id,
            conversation_topics=["work", "health"],
            interests=["technology"],
            communication_style=CommunicationStyle.CASUAL,
            call_duration_preference=CallDurationPreference.SHORT,
        )
        test_session.add(prefs)
        await test_session.commit()

        response = await authenticated_client.get("/api/preferences")
        assert response.status_code == 200
        data = response.json()
        assert data["conversation_topics"] == ["work", "health"]
        assert data["interests"] == ["technology"]
        assert data["communication_style"] == "casual"
        assert data["call_duration_preference"] == "short"

    async def test_put_preferences_creates_new(
        self, authenticated_client: AsyncClient, test_user: User
    ) -> None:
        """Test that PUT creates new preferences if none exist."""
        prefs_data = {
            "conversation_topics": ["family", "hobbies"],
            "interests": ["music", "sports"],
            "communication_style": "formal",
            "call_duration_preference": "long",
        }
        response = await authenticated_client.put("/api/preferences", json=prefs_data)
        assert response.status_code == 200
        prefs = response.json()
        assert prefs["conversation_topics"] == ["family", "hobbies"]
        assert prefs["interests"] == ["music", "sports"]
        assert prefs["communication_style"] == "formal"
        assert prefs["call_duration_preference"] == "long"

    async def test_put_preferences_updates_existing(
        self, authenticated_client: AsyncClient, test_user: User, test_session: AsyncSession
    ) -> None:
        """Test that PUT updates existing preferences."""
        # Create preferences first
        prefs = UserPreferences(
            user_id=test_user.id,
            conversation_topics=["old_topic"],
            interests=["old_interest"],
            communication_style=CommunicationStyle.CASUAL,
            call_duration_preference=CallDurationPreference.SHORT,
        )
        test_session.add(prefs)
        await test_session.commit()

        # Update preferences
        update_data = {
            "conversation_topics": ["new_topic"],
            "communication_style": "formal",
        }
        response = await authenticated_client.put("/api/preferences", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["conversation_topics"] == ["new_topic"]
        assert data["communication_style"] == "formal"
        # Unchanged fields should remain
        assert data["interests"] == ["old_interest"]
        assert data["call_duration_preference"] == "short"

    async def test_put_preferences_partial_update(
        self, authenticated_client: AsyncClient, test_user: User
    ) -> None:
        """Test that PUT with partial data only updates provided fields."""
        # First create with PUT
        initial_data = {
            "conversation_topics": ["topic1"],
            "interests": ["interest1"],
            "communication_style": "casual",
            "call_duration_preference": "medium",
        }
        response = await authenticated_client.put("/api/preferences", json=initial_data)
        assert response.status_code == 200

        # Then update with only communication_style
        update_data = {"communication_style": "formal"}
        response = await authenticated_client.put("/api/preferences", json=update_data)
        assert response.status_code == 200
        prefs = response.json()
        assert prefs["communication_style"] == "formal"
        assert prefs["conversation_topics"] == ["topic1"]  # Unchanged
        assert prefs["interests"] == ["interest1"]  # Unchanged
        assert prefs["call_duration_preference"] == "medium"  # Unchanged

    async def test_delete_preferences_success(
        self, authenticated_client: AsyncClient, test_user: User, test_session: AsyncSession
    ) -> None:
        """Test that DELETE removes preferences."""
        # Create preferences first
        prefs = UserPreferences(
            user_id=test_user.id,
            conversation_topics=["topic"],
            interests=["interest"],
            communication_style=CommunicationStyle.FORMAL,
            call_duration_preference=CallDurationPreference.LONG,
        )
        test_session.add(prefs)
        await test_session.commit()

        # Delete
        response = await authenticated_client.delete("/api/preferences")
        assert response.status_code == 204

        # Verify deletion by getting (should create defaults)
        response = await authenticated_client.get("/api/preferences")
        assert response.status_code == 200
        data = response.json()
        assert data["conversation_topics"] == []  # Reset to default

    async def test_delete_preferences_nonexistent(
        self, authenticated_client: AsyncClient, test_user: User
    ) -> None:
        """Test that DELETE with no existing preferences returns 204 (idempotent)."""
        response = await authenticated_client.delete("/api/preferences")
        assert response.status_code == 204

    async def test_put_preferences_invalid_style(self, authenticated_client: AsyncClient) -> None:
        """Test that PUT with invalid communication_style returns 422."""
        prefs_data = {"communication_style": "invalid_style"}
        response = await authenticated_client.put("/api/preferences", json=prefs_data)
        assert response.status_code == 422

    async def test_put_preferences_invalid_duration(
        self, authenticated_client: AsyncClient
    ) -> None:
        """Test that PUT with invalid call_duration_preference returns 422."""
        prefs_data = {"call_duration_preference": "super_long"}
        response = await authenticated_client.put("/api/preferences", json=prefs_data)
        assert response.status_code == 422
