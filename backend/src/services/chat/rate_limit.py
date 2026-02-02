"""Rate limiting for the nutrition chat agent.

Provides functions to check and enforce daily message limits per user.
"""

from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.models import Conversation, Message, MessageRole

logger = structlog.get_logger()


class RateLimitExceededError(Exception):
    """Raised when user exceeds the daily chat rate limit."""

    pass


async def get_daily_message_count(db: AsyncSession, user_id: UUID) -> int:
    """Get the count of user messages sent today (UTC).

    Args:
        db: Async database session.
        user_id: UUID of the user to count messages for.

    Returns:
        Number of user messages sent today.
    """
    today_utc = datetime.now(UTC).date()
    today_start = datetime.combine(today_utc, datetime.min.time()).replace(tzinfo=UTC)
    today_end = datetime.combine(today_utc, datetime.max.time()).replace(tzinfo=UTC)

    result = await db.execute(
        select(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Conversation.user_id == user_id,
            Message.role == MessageRole.USER,
            Message.created_at >= today_start,
            Message.created_at <= today_end,
        )
    )
    return result.scalar() or 0


async def check_rate_limit(db: AsyncSession, user_id: UUID) -> bool:
    """Check if user is within the daily rate limit.

    Counts the user's messages from the current UTC day and raises
    RateLimitExceededError if the limit is exceeded.

    Args:
        db: Async database session.
        user_id: UUID of the user to check.

    Returns:
        True if user is within limit.

    Raises:
        RateLimitExceededError: If user has exceeded the daily limit.
    """
    settings = get_settings()
    limit = settings.CHAT_RATE_LIMIT_PER_DAY

    message_count = await get_daily_message_count(db, user_id)

    log = logger.bind(user_id=str(user_id), message_count=message_count, limit=limit)

    if message_count >= limit:
        log.warning("rate_limit_exceeded")
        raise RateLimitExceededError(
            f"Daily message limit of {limit} exceeded. Please try again tomorrow."
        )

    log.debug("rate_limit_check_passed")
    return True
