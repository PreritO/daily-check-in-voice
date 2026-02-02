"""Chat API endpoints for the nutrition assistant.

This module provides endpoints for managing conversations and sending messages
to the AI nutrition assistant. Supports streaming responses via Server-Sent Events.
"""

import json
from collections.abc import AsyncGenerator
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.dependencies import get_or_create_user
from src.api.schemas import (
    ConversationResponse,
    ConversationWithMessagesResponse,
    MessageCreate,
)
from src.database import get_db
from src.models import Conversation, User
from src.services.chat.chat_service import ChatService
from src.services.chat.rate_limit import RateLimitExceededError, check_rate_limit

logger = structlog.get_logger()

router = APIRouter()


# =============================================================================
# Conversation Endpoints
# =============================================================================


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> Conversation:
    """Create a new conversation.

    Args:
        current_user: The authenticated user.
        db: Database session.

    Returns:
        The newly created conversation.
    """
    conversation = Conversation(user_id=current_user.id)
    db.add(conversation)
    await db.flush()

    # Re-fetch with selectinload to eager-load messages for message_count
    # (required for async SQLAlchemy - lazy loading doesn't work)
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation.id)
    )
    conversation = result.scalar_one()

    logger.info(
        "Conversation created",
        user_id=str(current_user.id),
        conversation_id=str(conversation.id),
    )

    return conversation


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum records to return"),
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> list[Conversation]:
    """List user's conversations.

    Args:
        skip: Number of records to skip for pagination.
        limit: Maximum number of records to return.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        List of conversations ordered by most recently updated first.
    """
    # Use selectinload to eager-load messages for message_count calculation
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    conversations = list(result.scalars().all())

    logger.debug(
        "Conversations listed",
        user_id=str(current_user.id),
        count=len(conversations),
    )

    return conversations


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationWithMessagesResponse,
)
async def get_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> Conversation:
    """Get a conversation with all its messages.

    Args:
        conversation_id: The conversation ID.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        The conversation with its messages.

    Raises:
        HTTPException: 404 if conversation not found.
    """
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id {conversation_id} not found",
        )

    logger.debug(
        "Conversation retrieved",
        user_id=str(current_user.id),
        conversation_id=str(conversation_id),
        message_count=len(conversation.messages),
    )

    return conversation


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a conversation and all its messages.

    Args:
        conversation_id: The conversation ID.
        current_user: The authenticated user.
        db: Database session.

    Raises:
        HTTPException: 404 if conversation not found.
    """
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id {conversation_id} not found",
        )

    await db.delete(conversation)
    await db.flush()

    logger.info(
        "Conversation deleted",
        user_id=str(current_user.id),
        conversation_id=str(conversation_id),
    )


# =============================================================================
# Message Endpoints (Streaming)
# =============================================================================


async def generate_sse_stream(
    chat_service: ChatService,
    conversation_id: UUID,
    user_message: str,
) -> AsyncGenerator[str, None]:
    """Generate Server-Sent Events from the chat service.

    Args:
        chat_service: The chat service instance.
        conversation_id: The conversation ID.
        user_message: The user's message content.

    Yields:
        SSE-formatted event strings.
    """
    try:
        async for chunk in chat_service.chat(conversation_id, user_message):
            # SSE format: data: <json>\n\n
            yield f"data: {json.dumps({'content': chunk})}\n\n"

        # Signal completion
        yield f"data: {json.dumps({'done': True})}\n\n"

    except RateLimitExceededError as e:
        logger.warning(
            "Rate limit exceeded during streaming",
            error=str(e),
        )
        yield f"data: {json.dumps({'error': str(e), 'error_type': 'rate_limit'})}\n\n"

    except Exception as e:
        logger.exception(
            "Error during chat streaming",
            error=str(e),
        )
        yield f"data: {json.dumps({'error': 'An error occurred while processing your message', 'error_type': 'internal'})}\n\n"


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: UUID,
    message: MessageCreate,
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Send a message and stream the assistant response via SSE.

    The response is streamed as Server-Sent Events (SSE) with the following format:
    - Content chunks: `data: {"content": "..."}\n\n`
    - Completion: `data: {"done": true}\n\n`
    - Errors: `data: {"error": "...", "error_type": "internal"}\n\n`

    Args:
        conversation_id: The conversation ID.
        message: The message to send.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        StreamingResponse with text/event-stream content type.

    Raises:
        HTTPException: 404 if conversation not found, 429 if rate limit exceeded.
    """
    # Verify conversation exists and belongs to user
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id {conversation_id} not found",
        )

    # Check rate limit before starting stream (return proper HTTP 429)
    try:
        await check_rate_limit(db, current_user.id)
    except RateLimitExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e),
        ) from e

    logger.info(
        "Starting chat message stream",
        user_id=str(current_user.id),
        conversation_id=str(conversation_id),
        message_length=len(message.content),
    )

    chat_service = ChatService(db, current_user.id)

    return StreamingResponse(
        generate_sse_stream(chat_service, conversation_id, message.content),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
