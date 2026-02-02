"""Integration tests for ChatService and chat flow."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.models import Conversation, Message, MessageRole
from src.services.chat.rate_limit import (
    RateLimitExceededError,
    check_rate_limit,
    get_daily_message_count,
)


class TestRateLimit:
    """Tests for rate limiting functionality."""

    @pytest.mark.asyncio
    async def test_get_daily_message_count_empty(self) -> None:
        """Test that count returns 0 when no messages exist."""
        # Create mock db that returns 0
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 0
        mock_db.execute.return_value = mock_result

        count = await get_daily_message_count(mock_db, uuid4())

        assert count == 0
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_daily_message_count_with_messages(self) -> None:
        """Test that count returns correct value when messages exist."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 5
        mock_db.execute.return_value = mock_result

        count = await get_daily_message_count(mock_db, uuid4())

        assert count == 5

    @pytest.mark.asyncio
    async def test_check_rate_limit_within_limit(self) -> None:
        """Test that check_rate_limit passes when under limit."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 10  # Under default 100 limit
        mock_db.execute.return_value = mock_result

        result = await check_rate_limit(mock_db, uuid4())

        assert result is True

    @pytest.mark.asyncio
    async def test_check_rate_limit_at_limit(self) -> None:
        """Test that check_rate_limit raises when at limit."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 100  # At default limit
        mock_db.execute.return_value = mock_result

        with pytest.raises(RateLimitExceededError) as exc_info:
            await check_rate_limit(mock_db, uuid4())

        assert "Daily message limit" in str(exc_info.value)
        assert "100" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_check_rate_limit_over_limit(self) -> None:
        """Test that check_rate_limit raises when over limit."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 150  # Over default limit
        mock_db.execute.return_value = mock_result

        with pytest.raises(RateLimitExceededError):
            await check_rate_limit(mock_db, uuid4())


class TestRateLimitExceededError:
    """Tests for RateLimitExceededError exception."""

    def test_error_message(self) -> None:
        """Test that error has correct message format."""
        error = RateLimitExceededError("Custom message")

        assert str(error) == "Custom message"

    def test_is_exception_subclass(self) -> None:
        """Test that error is proper Exception subclass."""
        assert issubclass(RateLimitExceededError, Exception)


class TestConversationModel:
    """Tests for Conversation model behavior."""

    def test_conversation_creation(self) -> None:
        """Test that Conversation model can be instantiated."""
        user_id = uuid4()
        conv = Conversation(user_id=user_id, title="Test Conversation")

        assert conv.user_id == user_id
        assert conv.title == "Test Conversation"

    def test_conversation_without_title(self) -> None:
        """Test that Conversation can be created without title."""
        user_id = uuid4()
        conv = Conversation(user_id=user_id)

        assert conv.user_id == user_id
        assert conv.title is None


class TestMessageModel:
    """Tests for Message model behavior."""

    def test_message_creation(self) -> None:
        """Test that Message model can be instantiated."""
        conv_id = uuid4()
        msg = Message(
            conversation_id=conv_id,
            role=MessageRole.USER,
            content="Hello!",
        )

        assert msg.conversation_id == conv_id
        assert msg.role == MessageRole.USER
        assert msg.content == "Hello!"

    def test_message_roles(self) -> None:
        """Test that all message roles can be used."""
        conv_id = uuid4()

        for role in [
            MessageRole.USER,
            MessageRole.ASSISTANT,
            MessageRole.SYSTEM,
            MessageRole.TOOL,
        ]:
            msg = Message(
                conversation_id=conv_id,
                role=role,
                content="Test",
            )
            assert msg.role == role

    def test_message_with_tool_calls(self) -> None:
        """Test that Message can have tool_calls JSON."""
        conv_id = uuid4()
        tool_calls = [{"id": "call_1", "function": {"name": "get_food_logs"}}]

        msg = Message(
            conversation_id=conv_id,
            role=MessageRole.ASSISTANT,
            content=None,
            tool_calls=tool_calls,
        )

        assert msg.tool_calls == tool_calls

    def test_message_with_tool_call_id(self) -> None:
        """Test that Message can have tool_call_id for tool responses."""
        conv_id = uuid4()

        msg = Message(
            conversation_id=conv_id,
            role=MessageRole.TOOL,
            content='{"result": "data"}',
            tool_call_id="call_1",
        )

        assert msg.tool_call_id == "call_1"


class TestMessageRole:
    """Tests for MessageRole enum."""

    def test_role_values(self) -> None:
        """Test that MessageRole has expected values."""
        assert MessageRole.USER.value == "user"
        assert MessageRole.ASSISTANT.value == "assistant"
        assert MessageRole.SYSTEM.value == "system"
        assert MessageRole.TOOL.value == "tool"

    def test_role_count(self) -> None:
        """Test that there are exactly 4 roles."""
        roles = list(MessageRole)
        assert len(roles) == 4


class TestChatServiceIntegration:
    """Integration tests for ChatService.

    These tests mock the OpenAI client but test the full flow.
    """

    @pytest.mark.asyncio
    async def test_chat_service_initialization(self) -> None:
        """Test that ChatService can be initialized."""
        from src.services.chat.chat_service import ChatService

        mock_db = AsyncMock()
        user_id = uuid4()

        with patch("src.services.chat.chat_service.AsyncOpenAI"):
            service = ChatService(mock_db, user_id)

            assert service.db == mock_db
            assert service.user_id == user_id
            assert service.tool_executor is not None

    @pytest.mark.asyncio
    async def test_chat_rate_limit_checked(self) -> None:
        """Test that chat method checks rate limit."""
        from src.services.chat.chat_service import ChatService

        mock_db = AsyncMock()
        user_id = uuid4()

        # Mock rate limit to raise
        with (
            patch("src.services.chat.chat_service.AsyncOpenAI"),
            patch(
                "src.services.chat.chat_service.check_rate_limit",
                side_effect=RateLimitExceededError("Limit exceeded"),
            ),
        ):
            service = ChatService(mock_db, user_id)

            with pytest.raises(RateLimitExceededError):
                # Need to consume the async generator
                async for _ in service.chat(None, "Hello"):
                    pass


class TestStreamingResponse:
    """Tests for streaming response format."""

    def test_sse_format_content(self) -> None:
        """Test that SSE content format is correct."""
        import json

        # Simulate SSE chunk
        chunk = {"content": "Hello", "done": False}
        sse_data = f"data: {json.dumps(chunk)}\n\n"

        assert sse_data.startswith("data: ")
        assert sse_data.endswith("\n\n")
        parsed = json.loads(sse_data[6:-2])
        assert parsed["content"] == "Hello"

    def test_sse_format_done(self) -> None:
        """Test that SSE done format is correct."""
        import json

        # Simulate SSE completion
        chunk = {"done": True}
        sse_data = f"data: {json.dumps(chunk)}\n\n"

        parsed = json.loads(sse_data[6:-2])
        assert parsed["done"] is True

    def test_sse_format_error(self) -> None:
        """Test that SSE error format is correct."""
        import json

        # Simulate SSE error
        chunk = {"error": "Rate limit exceeded", "error_type": "rate_limit"}
        sse_data = f"data: {json.dumps(chunk)}\n\n"

        parsed = json.loads(sse_data[6:-2])
        assert parsed["error"] == "Rate limit exceeded"
        assert parsed["error_type"] == "rate_limit"
