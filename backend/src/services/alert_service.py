"""Alert service for creating and managing user alerts."""

from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Alert, AlertType, MoodAnalysis, SentimentType

logger = structlog.get_logger()


def create_mood_alert(
    user_id: UUID,
    call_id: UUID,
    mood_analysis: MoodAnalysis,
) -> Alert | None:
    """
    Create an alert if the mood analysis indicates concerning sentiment.

    Creates an alert for:
    - NEGATIVE sentiment
    - CONCERNED sentiment
    - Any flagged issues

    Args:
        user_id: The user's UUID.
        call_id: The call's UUID.
        mood_analysis: The analyzed mood data.

    Returns:
        Alert object if concerning mood detected, None otherwise.
    """
    log = logger.bind(
        user_id=str(user_id),
        call_id=str(call_id),
        sentiment=mood_analysis.overall_sentiment.value,
    )

    # Check if alert is warranted
    should_alert = False
    title = ""
    message_parts = []

    if mood_analysis.overall_sentiment == SentimentType.NEGATIVE:
        should_alert = True
        title = "Negative mood detected"
        message_parts.append("Your recent check-in showed signs of negative mood.")

    elif mood_analysis.overall_sentiment == SentimentType.CONCERNED:
        should_alert = True
        title = "Concerning mood detected"
        message_parts.append("Your recent check-in raised some concerns.")

    # Add flags to message if present
    if mood_analysis.flags:
        should_alert = True
        if not title:
            title = "Check-in flags raised"
        message_parts.append(f"Flags: {', '.join(mood_analysis.flags)}")

    # Add notes if present
    if mood_analysis.notes:
        message_parts.append(f"Notes: {mood_analysis.notes}")

    if not should_alert:
        log.debug("no_alert_needed", reason="mood_not_concerning")
        return None

    message = " ".join(message_parts)
    log.info("creating_mood_alert", title=title)

    return Alert(
        user_id=user_id,
        call_id=call_id,
        alert_type=AlertType.MOOD_CONCERN,
        title=title,
        message=message,
        acknowledged=False,
    )


async def get_unacknowledged_alerts(
    user_id: UUID,
    db: AsyncSession,
    limit: int = 10,
) -> list[Alert]:
    """
    Get unacknowledged alerts for a user.

    Args:
        user_id: The user's UUID.
        db: Database session.
        limit: Maximum number of alerts to return.

    Returns:
        List of unacknowledged alerts, ordered by created_at descending.
    """
    log = logger.bind(user_id=str(user_id))
    log.debug("fetching_unacknowledged_alerts", limit=limit)

    result = await db.execute(
        select(Alert)
        .where(Alert.user_id == user_id)
        .where(Alert.acknowledged == False)  # noqa: E712
        .order_by(Alert.created_at.desc())
        .limit(limit)
    )
    alerts = result.scalars().all()

    log.info("unacknowledged_alerts_fetched", count=len(alerts))
    return list(alerts)


async def get_all_alerts(
    user_id: UUID,
    db: AsyncSession,
    limit: int = 50,
) -> list[Alert]:
    """
    Get all alerts for a user (including acknowledged).

    Args:
        user_id: The user's UUID.
        db: Database session.
        limit: Maximum number of alerts to return.

    Returns:
        List of all alerts, ordered by created_at descending.
    """
    log = logger.bind(user_id=str(user_id))
    log.debug("fetching_all_alerts", limit=limit)

    result = await db.execute(
        select(Alert).where(Alert.user_id == user_id).order_by(Alert.created_at.desc()).limit(limit)
    )
    alerts = result.scalars().all()

    log.info("all_alerts_fetched", count=len(alerts))
    return list(alerts)


async def acknowledge_alert(
    alert_id: UUID,
    user_id: UUID,
    db: AsyncSession,
) -> Alert | None:
    """
    Acknowledge an alert for a user.

    Args:
        alert_id: The alert's UUID.
        user_id: The user's UUID (for authorization).
        db: Database session.

    Returns:
        Updated Alert if found and owned by user, None otherwise.
    """
    log = logger.bind(alert_id=str(alert_id), user_id=str(user_id))
    log.debug("acknowledging_alert")

    # Fetch the alert first to verify ownership
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id).where(Alert.user_id == user_id)
    )
    alert = result.scalar_one_or_none()

    if alert is None:
        log.warning("alert_not_found_or_unauthorized")
        return None

    alert.acknowledged = True
    alert.acknowledged_at = datetime.now(UTC)
    await db.flush()

    log.info("alert_acknowledged")
    return alert
