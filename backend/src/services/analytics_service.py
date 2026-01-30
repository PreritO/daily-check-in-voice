"""User analytics service for computing call statistics and mood trends."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Call, CallStatus, MoodAnalysis, SentimentType

logger = structlog.get_logger()


@dataclass
class MoodTrendItem:
    """Single data point in the mood trend."""

    call_date: date
    sentiment: SentimentType
    confidence: float


@dataclass
class UserAnalytics:
    """Aggregated analytics for a user's call history."""

    total_calls: int
    total_duration_minutes: float
    average_call_duration: float
    calls_this_week: int
    calls_this_month: int
    mood_trend: list[MoodTrendItem]
    streak_days: int


async def _get_total_calls(user_id: UUID, db: AsyncSession) -> int:
    """Get total number of completed calls for a user.

    Args:
        user_id: The user's UUID.
        db: The async database session.

    Returns:
        Total count of completed calls.
    """
    result = await db.execute(
        select(func.count())
        .select_from(Call)
        .where(Call.user_id == user_id)
        .where(Call.status == CallStatus.COMPLETED)
    )
    return result.scalar() or 0


async def _get_duration_stats(user_id: UUID, db: AsyncSession) -> tuple[float, float]:
    """Get total and average call duration in minutes for a user.

    Args:
        user_id: The user's UUID.
        db: The async database session.

    Returns:
        Tuple of (total_minutes, average_minutes). Returns (0.0, 0.0) if no calls.
    """
    # Calculate duration using epoch timestamps
    duration_expr = func.extract("epoch", Call.ended_at) - func.extract("epoch", Call.started_at)

    result = await db.execute(
        select(
            func.sum(duration_expr),
            func.avg(duration_expr),
        )
        .select_from(Call)
        .where(Call.user_id == user_id)
        .where(Call.status == CallStatus.COMPLETED)
        .where(Call.started_at.isnot(None))
        .where(Call.ended_at.isnot(None))
    )

    row = result.one()
    total_seconds = row[0] or 0.0
    avg_seconds = row[1] or 0.0

    # Convert seconds to minutes
    total_minutes = float(total_seconds) / 60.0
    avg_minutes = float(avg_seconds) / 60.0

    return total_minutes, avg_minutes


async def _get_period_counts(
    user_id: UUID,
    db: AsyncSession,
    user_tz: ZoneInfo,
) -> tuple[int, int]:
    """Get call counts for the current week and month.

    Args:
        user_id: The user's UUID.
        db: The async database session.
        user_tz: The user's timezone for date calculations.

    Returns:
        Tuple of (calls_this_week, calls_this_month).
    """
    # Get current time in user's timezone
    now_local = datetime.now(user_tz)
    today_local = now_local.date()

    # Calculate start of week (Monday) and start of month
    days_since_monday = today_local.weekday()
    week_start = today_local - timedelta(days=days_since_monday)
    month_start = today_local.replace(day=1)

    # Convert to UTC datetimes for comparison with DB timestamps
    # Then remove tzinfo since DB stores TIMESTAMP WITHOUT TIME ZONE
    week_start_utc = (
        datetime.combine(week_start, datetime.min.time(), tzinfo=user_tz)
        .astimezone(ZoneInfo("UTC"))
        .replace(tzinfo=None)
    )
    month_start_utc = (
        datetime.combine(month_start, datetime.min.time(), tzinfo=user_tz)
        .astimezone(ZoneInfo("UTC"))
        .replace(tzinfo=None)
    )

    # Get week count
    week_result = await db.execute(
        select(func.count())
        .select_from(Call)
        .where(Call.user_id == user_id)
        .where(Call.status == CallStatus.COMPLETED)
        .where(Call.started_at >= week_start_utc)
    )
    calls_this_week = week_result.scalar() or 0

    # Get month count
    month_result = await db.execute(
        select(func.count())
        .select_from(Call)
        .where(Call.user_id == user_id)
        .where(Call.status == CallStatus.COMPLETED)
        .where(Call.started_at >= month_start_utc)
    )
    calls_this_month = month_result.scalar() or 0

    return calls_this_week, calls_this_month


async def _get_mood_trend(
    user_id: UUID,
    db: AsyncSession,
    user_tz: ZoneInfo,
    limit: int = 10,
) -> list[MoodTrendItem]:
    """Get the mood trend from recent completed calls with mood analysis.

    Args:
        user_id: The user's UUID.
        db: The async database session.
        user_tz: The user's timezone for date calculations.
        limit: Maximum number of mood data points to return.

    Returns:
        List of MoodTrendItem objects, ordered from oldest to newest.
    """
    result = await db.execute(
        select(
            Call.started_at,
            MoodAnalysis.overall_sentiment,
            MoodAnalysis.confidence,
        )
        .join(MoodAnalysis, Call.id == MoodAnalysis.call_id)
        .where(Call.user_id == user_id)
        .where(Call.status == CallStatus.COMPLETED)
        .where(Call.started_at.isnot(None))
        .order_by(Call.started_at.desc())
        .limit(limit)
    )

    rows = result.all()

    # Convert to MoodTrendItem list, reversing to get oldest first
    trend_items = []
    for row in reversed(rows):
        started_at, sentiment, confidence = row
        if started_at is not None:
            # Convert UTC timestamp to user's local timezone for consistent date handling
            if started_at.tzinfo is None:
                local_dt = started_at.replace(tzinfo=ZoneInfo("UTC")).astimezone(user_tz)
            else:
                local_dt = started_at.astimezone(user_tz)
            trend_items.append(
                MoodTrendItem(
                    call_date=local_dt.date(),
                    sentiment=sentiment,
                    confidence=confidence,
                )
            )

    return trend_items


async def _calculate_streak_days(
    user_id: UUID,
    db: AsyncSession,
    user_tz: ZoneInfo,
) -> int:
    """Calculate the current streak of consecutive days with completed calls.

    The streak is lenient: it includes today OR yesterday as valid starting points,
    so a user who completed a call yesterday but not yet today won't lose their streak.

    Args:
        user_id: The user's UUID.
        db: The async database session.
        user_tz: The user's timezone for date calculations.

    Returns:
        Number of consecutive days with completed calls.
    """
    # Get current date in user's timezone
    now_local = datetime.now(user_tz)
    today_local = now_local.date()
    yesterday_local = today_local - timedelta(days=1)

    # Get all completed call dates for this user, ordered by date descending
    # We need to convert UTC timestamps to user timezone to get the correct local dates
    result = await db.execute(
        select(Call.started_at)
        .where(Call.user_id == user_id)
        .where(Call.status == CallStatus.COMPLETED)
        .where(Call.started_at.isnot(None))
        .order_by(Call.started_at.desc())
    )

    rows = result.all()

    if not rows:
        return 0

    # Convert UTC timestamps to local dates and deduplicate
    call_dates: set[date] = set()
    for (started_at,) in rows:
        if started_at is not None:
            # Convert UTC timestamp to user's local timezone (defensive: handle both naive and aware)
            if started_at.tzinfo is None:
                local_dt = started_at.replace(tzinfo=ZoneInfo("UTC")).astimezone(user_tz)
            else:
                local_dt = started_at.astimezone(user_tz)
            call_dates.add(local_dt.date())

    if not call_dates:
        return 0

    # Sort dates descending
    sorted_dates = sorted(call_dates, reverse=True)
    most_recent_date = sorted_dates[0]

    # Check if streak is active (most recent call is today or yesterday)
    if most_recent_date != today_local and most_recent_date != yesterday_local:
        return 0

    # Count consecutive days backwards from most recent call date
    streak = 0
    expected_date = most_recent_date

    for call_date in sorted_dates:
        if call_date == expected_date:
            streak += 1
            expected_date = expected_date - timedelta(days=1)
        elif call_date < expected_date:
            # Gap detected, streak ends
            break
        # If call_date > expected_date, it's a duplicate or future date, skip it

    return streak


async def get_user_analytics(
    user_id: UUID,
    db: AsyncSession,
    user_timezone: str = "UTC",
) -> UserAnalytics:
    """Compute comprehensive analytics for a user's call history.

    Args:
        user_id: The user's UUID.
        db: The async database session.
        user_timezone: The user's timezone string (e.g., "America/New_York").
                      Falls back to UTC if invalid.

    Returns:
        UserAnalytics dataclass with all computed metrics.
    """
    log = logger.bind(user_id=str(user_id))
    log.info("computing_user_analytics")

    # Parse timezone, fallback to UTC if invalid
    try:
        user_tz = ZoneInfo(user_timezone)
    except (KeyError, ValueError):
        log.warning("invalid_timezone_fallback_to_utc", timezone=user_timezone)
        user_tz = ZoneInfo("UTC")

    # Compute all stats
    total_calls = await _get_total_calls(user_id, db)
    total_minutes, avg_minutes = await _get_duration_stats(user_id, db)
    calls_this_week, calls_this_month = await _get_period_counts(user_id, db, user_tz)
    mood_trend = await _get_mood_trend(user_id, db, user_tz)
    streak_days = await _calculate_streak_days(user_id, db, user_tz)

    analytics = UserAnalytics(
        total_calls=total_calls,
        total_duration_minutes=round(total_minutes, 1),
        average_call_duration=round(avg_minutes, 1),
        calls_this_week=calls_this_week,
        calls_this_month=calls_this_month,
        mood_trend=mood_trend,
        streak_days=streak_days,
    )

    log.info(
        "user_analytics_computed",
        total_calls=total_calls,
        total_duration_minutes=round(total_minutes, 1),
        streak_days=streak_days,
        mood_trend_count=len(mood_trend),
    )

    return analytics
