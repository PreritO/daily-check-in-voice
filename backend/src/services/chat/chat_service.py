"""Chat service with agent loop for nutrition assistant.

This module provides the ChatService class that manages chat conversations,
implements the OpenAI agent loop with tool execution, and handles message
persistence.
"""

import json
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from uuid import UUID

import openai
import structlog
from openai import AsyncOpenAI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.models import Conversation, Message, MessageRole

from .prompts import build_system_prompt
from .tool_executor import ToolExecutor
from .tools import AGENT_TOOLS

logger = structlog.get_logger()

# Maximum iterations for the agent loop to prevent infinite loops
MAX_AGENT_ITERATIONS = 5


class RateLimitExceededError(Exception):
    """Raised when user exceeds the daily chat rate limit."""

    pass


class ChatService:
    """Service for managing chat conversations with the nutrition assistant.

    Handles conversation creation, message persistence, and the OpenAI
    agent loop with tool execution for querying user health data.
    """

    def __init__(self, db: AsyncSession, user_id: UUID) -> None:
        """Initialize the chat service.

        Args:
            db: Async database session.
            user_id: UUID of the user for this chat session.
        """
        self.db = db
        self.user_id = user_id
        self.settings = get_settings()
        self.logger = logger.bind(service="chat_service", user_id=str(user_id))

        # Initialize OpenAI client
        self.openai_client = AsyncOpenAI(api_key=self.settings.OPENAI_API_KEY)

        # Initialize tool executor
        self.tool_executor = ToolExecutor(db, user_id)

    async def chat(
        self,
        conversation_id: UUID | None,
        user_message: str,
        stream: bool = True,
    ) -> AsyncGenerator[str, None]:
        """Process a user message and stream the assistant response.

        Args:
            conversation_id: Optional conversation ID to continue. Creates new
                            conversation if None.
            user_message: The user's message text.
            stream: Whether to stream the response (default True).

        Yields:
            String chunks of the assistant's response.

        Raises:
            RateLimitExceededError: If user has exceeded daily message limit.
        """
        # Check rate limit first
        await self._check_rate_limit()

        # Get or create conversation
        conversation = await self._get_or_create_conversation(conversation_id)
        self.logger.info(
            "chat_started",
            conversation_id=str(conversation.id),
            message_length=len(user_message),
        )

        # Save user message to DB
        await self._save_message(
            conversation_id=conversation.id,
            role=MessageRole.USER,
            content=user_message,
        )

        # Get conversation history (includes the just-saved user message)
        history = await self._get_conversation_history(
            conversation_id=conversation.id,
            limit=self.settings.CHAT_MAX_HISTORY_MESSAGES,
        )

        # Build OpenAI messages array from history (no need to append user message separately)
        messages = self._build_messages(history)

        # Run agent loop with streaming
        full_response = ""
        async for chunk in self._agent_loop(messages):
            full_response += chunk
            yield chunk

        # Save assistant message after streaming completes
        if full_response:
            await self._save_message(
                conversation_id=conversation.id,
                role=MessageRole.ASSISTANT,
                content=full_response,
            )

        self.logger.info(
            "chat_completed",
            conversation_id=str(conversation.id),
            response_length=len(full_response),
        )

    async def _get_or_create_conversation(self, conversation_id: UUID | None) -> Conversation:
        """Get existing conversation or create a new one.

        Args:
            conversation_id: Optional conversation ID to retrieve.

        Returns:
            Existing conversation if found and belongs to user,
            otherwise a new conversation.
        """
        if conversation_id is not None:
            # Try to get existing conversation
            result = await self.db.execute(
                select(Conversation).where(
                    Conversation.id == conversation_id,
                    Conversation.user_id == self.user_id,
                )
            )
            conversation = result.scalar_one_or_none()
            if conversation is not None:
                self.logger.debug(
                    "conversation_found",
                    conversation_id=str(conversation_id),
                )
                return conversation
            else:
                self.logger.warning(
                    "conversation_not_found",
                    conversation_id=str(conversation_id),
                )

        # Create new conversation
        conversation = Conversation(user_id=self.user_id)
        self.db.add(conversation)
        await self.db.flush()
        self.logger.info("conversation_created", conversation_id=str(conversation.id))
        return conversation

    async def _get_conversation_history(
        self, conversation_id: UUID, limit: int = 10
    ) -> list[Message]:
        """Get recent messages from a conversation.

        Args:
            conversation_id: The conversation to get history for.
            limit: Maximum number of messages to retrieve.

        Returns:
            List of messages in chronological order (oldest first).
        """
        # Get most recent messages, ordered by created_at desc
        result = await self.db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        messages = list(result.scalars().all())

        # Reverse to get chronological order
        messages.reverse()
        return messages

    def _build_messages(self, history: list[Message]) -> list[dict]:
        """Build the OpenAI messages array from conversation history.

        Args:
            history: List of messages in chronological order (includes current message).

        Returns:
            List of message dicts formatted for OpenAI API.
        """
        messages: list[dict] = []

        # Add system prompt
        system_prompt = build_system_prompt()
        messages.append({"role": "system", "content": system_prompt})

        # Convert history messages to OpenAI format
        for msg in history:
            message_dict: dict = {
                "role": msg.role.value,
                "content": msg.content,
            }

            # Include tool_calls if present (use None for content if only tool_calls)
            if msg.tool_calls:
                message_dict["tool_calls"] = msg.tool_calls
                if not msg.content:
                    message_dict["content"] = None

            # Include tool_call_id for tool messages
            if msg.tool_call_id:
                message_dict["tool_call_id"] = msg.tool_call_id

            messages.append(message_dict)

        return messages

    async def _agent_loop(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        """Run the agent loop with tool execution.

        Calls OpenAI with streaming, yields content chunks to user,
        and handles tool calls by executing them and continuing the loop.

        Args:
            messages: The messages array to send to OpenAI.

        Yields:
            String chunks of the assistant's response content.
        """
        for iteration in range(MAX_AGENT_ITERATIONS):
            self.logger.debug("agent_loop_iteration", iteration=iteration)

            # Call OpenAI with streaming
            try:
                stream = await self.openai_client.chat.completions.create(
                    model=self.settings.OPENAI_MODEL,
                    messages=messages,  # type: ignore[arg-type]
                    tools=AGENT_TOOLS,
                    tool_choice="auto",
                    stream=True,
                )
            except openai.RateLimitError as e:
                self.logger.error("openai_rate_limit_error", error=str(e))
                yield "I'm temporarily unavailable due to high demand. Please try again in a moment."
                return
            except openai.APIError as e:
                self.logger.error("openai_api_error", error=str(e))
                yield "I encountered an error processing your request. Please try again."
                return

            # Accumulate response content and tool calls
            content_chunks: list[str] = []
            tool_calls_data: dict[int, dict] = {}  # index -> tool call data

            async for chunk in stream:
                # Skip chunks with empty choices
                if not chunk.choices:
                    continue

                delta = chunk.choices[0].delta
                finish_reason = chunk.choices[0].finish_reason

                # Stream content chunks to user
                if delta.content:
                    content_chunks.append(delta.content)
                    yield delta.content

                # Accumulate tool calls silently
                if delta.tool_calls:
                    for tool_call in delta.tool_calls:
                        idx = tool_call.index
                        if idx not in tool_calls_data:
                            tool_calls_data[idx] = {
                                "id": "",
                                "type": "function",
                                "function": {"name": "", "arguments": ""},
                            }

                        if tool_call.id:
                            tool_calls_data[idx]["id"] = tool_call.id
                        if tool_call.function:
                            if tool_call.function.name:
                                tool_calls_data[idx]["function"]["name"] = tool_call.function.name
                            if tool_call.function.arguments:
                                tool_calls_data[idx]["function"]["arguments"] += (
                                    tool_call.function.arguments
                                )

                # Check if we need to execute tools
                if finish_reason == "tool_calls":
                    break

            # Collect content and tool calls
            full_content = "".join(content_chunks)
            tool_calls_list = [tool_calls_data[i] for i in sorted(tool_calls_data.keys())]

            # If no tool calls, we are done
            if not tool_calls_list:
                return

            # Add assistant message with tool calls to messages
            # Use None for content if empty (OpenAI expects null, not empty string, with tool_calls)
            assistant_message: dict = {
                "role": "assistant",
                "content": full_content if full_content else None,
            }
            if tool_calls_list:
                assistant_message["tool_calls"] = tool_calls_list
            messages.append(assistant_message)

            # Execute tool calls and add results
            for tool_call in tool_calls_list:
                tool_name = tool_call["function"]["name"]
                tool_args_str = tool_call["function"]["arguments"]
                tool_call_id = tool_call["id"]

                self.logger.info(
                    "executing_tool_call",
                    tool_name=tool_name,
                    tool_call_id=tool_call_id,
                )

                try:
                    tool_args = json.loads(tool_args_str) if tool_args_str else {}
                except json.JSONDecodeError as e:
                    self.logger.error(
                        "tool_args_parse_error",
                        tool_name=tool_name,
                        error=str(e),
                    )
                    tool_args = {}

                # Execute the tool
                result = await self.tool_executor.execute(tool_name, tool_args)

                # Add tool result message
                tool_message = {
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "content": json.dumps(result),
                }
                messages.append(tool_message)

        # If we reach max iterations, send a graceful message
        self.logger.warning(
            "max_agent_iterations_reached",
            iterations=MAX_AGENT_ITERATIONS,
        )
        yield (
            "\n\nI apologize, but I was unable to complete this analysis within "
            "the allowed number of steps. Please try simplifying your question "
            "or breaking it into smaller parts."
        )

    async def _check_rate_limit(self) -> None:
        """Check if user has exceeded daily message rate limit.

        Raises:
            RateLimitExceededError: If user has exceeded the limit.
        """
        # Get today's date in UTC
        today_utc = datetime.now(UTC).date()
        today_start = datetime.combine(today_utc, datetime.min.time()).replace(tzinfo=UTC)
        today_end = datetime.combine(today_utc, datetime.max.time()).replace(tzinfo=UTC)

        # Count user messages from today using JOIN with Conversation
        result = await self.db.execute(
            select(func.count(Message.id))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(
                Conversation.user_id == self.user_id,
                Message.role == MessageRole.USER,
                Message.created_at >= today_start,
                Message.created_at <= today_end,
            )
        )
        message_count = result.scalar() or 0

        if message_count >= self.settings.CHAT_RATE_LIMIT_PER_DAY:
            self.logger.warning(
                "rate_limit_exceeded",
                message_count=message_count,
                limit=self.settings.CHAT_RATE_LIMIT_PER_DAY,
            )
            raise RateLimitExceededError(
                f"Daily message limit of {self.settings.CHAT_RATE_LIMIT_PER_DAY} exceeded. "
                "Please try again tomorrow."
            )

        self.logger.debug(
            "rate_limit_check_passed",
            message_count=message_count,
            limit=self.settings.CHAT_RATE_LIMIT_PER_DAY,
        )

    async def _save_message(
        self,
        conversation_id: UUID,
        role: MessageRole,
        content: str,
        tool_calls: list[dict] | None = None,
        tool_call_id: str | None = None,
        tokens_used: int | None = None,
    ) -> Message:
        """Save a message to the database.

        Args:
            conversation_id: The conversation to add the message to.
            role: The role of the message sender.
            content: The message content.
            tool_calls: Optional list of tool calls for assistant messages.
            tool_call_id: Optional tool call ID for tool response messages.
            tokens_used: Optional token count for the message.

        Returns:
            The created Message object.
        """
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            tool_calls=tool_calls,
            tool_call_id=tool_call_id,
            tokens_used=tokens_used,
        )
        self.db.add(message)
        await self.db.flush()

        self.logger.debug(
            "message_saved",
            message_id=str(message.id),
            role=role.value,
            content_length=len(content),
        )
        return message
