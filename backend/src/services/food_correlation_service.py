"""Food-level correlation service for analyzing specific foods and Bristol outcomes."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from uuid import UUID

import numpy as np
import structlog
from scipy import stats
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import FoodLog, HealthNote

logger = structlog.get_logger()


class InsufficientDataError(Exception):
    """Raised when there isn't enough data for meaningful analysis."""

    pass


@dataclass
class FoodCorrelationResult:
    """Result of correlation analysis for a specific food."""

    food_name: str
    times_eaten: int
    avg_bristol_after: float | None
    correlation: float
    p_value: float
    is_significant: bool
    is_trigger: bool  # True if food is associated with bad Bristol outcomes
    avg_bristol_when_eaten: float | None
    avg_bristol_when_not_eaten: float | None


@dataclass
class FoodAnalysisResponse:
    """Response containing food-level analysis results."""

    total_foods_analyzed: int
    total_food_logs: int
    total_bristol_events: int
    analysis_start_date: date
    analysis_end_date: date
    results: list[FoodCorrelationResult]
    trigger_foods: list[FoodCorrelationResult]


class FoodCorrelationService:
    """Service for analyzing correlations between specific foods and Bristol outcomes."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the service."""
        self.db = db

    async def analyze_foods(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
        min_occurrences: int = 3,
        time_lag_hours: int = 24,
    ) -> FoodAnalysisResponse:
        """
        Analyze food-level correlations with Bristol outcomes.

        Args:
            user_id: User ID to analyze
            start_date: Start of analysis period
            end_date: End of analysis period
            min_occurrences: Minimum times a food must be eaten to be analyzed
            time_lag_hours: Hours after eating to look for Bristol events

        Returns:
            FoodAnalysisResponse with all food correlation results
        """
        # Fetch food logs
        food_logs = await self._get_food_logs(user_id, start_date, end_date)

        # Fetch Bristol events (extend date range to capture after eating)
        extended_end = end_date + timedelta(hours=time_lag_hours + 24)
        bristol_events = await self._get_bristol_events(user_id, start_date, extended_end)

        if len(bristol_events) < 5:
            raise InsufficientDataError(
                f"Need at least 5 Bristol events for analysis, found {len(bristol_events)}"
            )

        # Group food logs by food_name
        food_occurrences: dict[str, list[FoodLog]] = {}
        for log in food_logs:
            if log.food_name not in food_occurrences:
                food_occurrences[log.food_name] = []
            food_occurrences[log.food_name].append(log)

        # Filter to foods eaten at least min_occurrences times
        filtered_foods = {
            name: logs for name, logs in food_occurrences.items() if len(logs) >= min_occurrences
        }

        logger.info(
            "analyzing_foods",
            user_id=str(user_id),
            total_foods=len(food_occurrences),
            filtered_foods=len(filtered_foods),
            bristol_events=len(bristol_events),
        )

        # Analyze each food
        results: list[FoodCorrelationResult] = []
        for food_name, food_logs_list in filtered_foods.items():
            result = self._analyze_single_food(
                food_name=food_name,
                food_logs_list=food_logs_list,
                bristol_events=bristol_events,
                time_lag_hours=time_lag_hours,
            )
            if result is not None:
                results.append(result)

        # Sort by absolute correlation strength
        results.sort(key=lambda r: abs(r.correlation), reverse=True)

        # Filter trigger foods
        trigger_foods = [r for r in results if r.is_trigger]

        return FoodAnalysisResponse(
            total_foods_analyzed=len(results),
            total_food_logs=len(food_logs),
            total_bristol_events=len(bristol_events),
            analysis_start_date=start_date,
            analysis_end_date=end_date,
            results=results,
            trigger_foods=trigger_foods,
        )

    async def _get_food_logs(
        self, user_id: UUID, start_date: date, end_date: date
    ) -> list[FoodLog]:
        """Fetch food logs for the user in date range."""
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())

        stmt = (
            select(FoodLog)
            .where(FoodLog.user_id == user_id)
            .where(FoodLog.logged_at >= start_dt)
            .where(FoodLog.logged_at <= end_dt)
            .order_by(FoodLog.logged_at)
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _get_bristol_events(
        self, user_id: UUID, start_date: date, end_date: date
    ) -> list[HealthNote]:
        """Fetch Bristol events for the user in date range."""
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())

        stmt = (
            select(HealthNote)
            .where(HealthNote.user_id == user_id)
            .where(HealthNote.is_bowel_movement.is_(True))
            .where(HealthNote.bristol_scale.isnot(None))
            .where(HealthNote.logged_at >= start_dt)
            .where(HealthNote.logged_at <= end_dt)
            .order_by(HealthNote.logged_at)
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    def _analyze_single_food(
        self,
        food_name: str,
        food_logs_list: list[FoodLog],
        bristol_events: list[HealthNote],
        time_lag_hours: int,
    ) -> FoodCorrelationResult | None:
        """
        Analyze correlation between a single food and Bristol outcomes.

        For each time a food was eaten, find Bristol events in the next
        time_lag_hours window and compute correlation.
        """
        # Create a binary indicator for each Bristol event:
        # 1 if food was eaten in the preceding time_lag_hours, 0 otherwise
        food_eaten_before: list[int] = []
        bristol_scores: list[int] = []

        # Get all food eating times for this food
        eating_times = {log.logged_at for log in food_logs_list}

        for bristol_event in bristol_events:
            event_time = bristol_event.logged_at
            window_start = event_time - timedelta(hours=time_lag_hours)

            # Check if food was eaten in the window before this Bristol event
            food_eaten = any(window_start <= eat_time <= event_time for eat_time in eating_times)

            food_eaten_before.append(1 if food_eaten else 0)
            bristol_scores.append(bristol_event.bristol_scale)

        if len(bristol_scores) < 5:
            return None

        # Calculate point-biserial correlation (binary vs continuous)
        eaten_array = np.array(food_eaten_before)
        bristol_array = np.array(bristol_scores)

        # Need variance in both variables
        if eaten_array.std() == 0 or bristol_array.std() == 0:
            return None

        # Calculate correlation
        correlation, p_value = stats.pointbiserialr(eaten_array, bristol_array)

        # Handle NaN
        if np.isnan(correlation):
            return None

        is_significant = p_value < 0.05

        # Calculate average Bristol when eaten vs not eaten
        eaten_mask = eaten_array == 1
        not_eaten_mask = eaten_array == 0

        avg_when_eaten = float(bristol_array[eaten_mask].mean()) if eaten_mask.sum() > 0 else None
        avg_when_not_eaten = (
            float(bristol_array[not_eaten_mask].mean()) if not_eaten_mask.sum() > 0 else None
        )

        # Determine if this is a trigger food
        # A trigger food is one where eating it correlates with Bristol scores
        # outside the healthy range (< 3 or > 5)
        is_trigger = False
        if is_significant and avg_when_eaten is not None:
            # Negative correlation = lower Bristol when eaten (constipation direction)
            # Positive correlation = higher Bristol when eaten (diarrhea direction)
            if correlation < -0.15 and avg_when_eaten < 3:
                is_trigger = True  # Associated with constipation
            elif correlation > 0.15 and avg_when_eaten > 5:
                is_trigger = True  # Associated with diarrhea
            # Also consider if eating the food moves Bristol away from healthy range
            elif (
                avg_when_not_eaten is not None
                and 3 <= avg_when_not_eaten <= 5
                and (avg_when_eaten < 3 or avg_when_eaten > 5)
            ):
                is_trigger = True

        return FoodCorrelationResult(
            food_name=food_name,
            times_eaten=len(food_logs_list),
            avg_bristol_after=avg_when_eaten,
            correlation=float(correlation),
            p_value=float(p_value),
            is_significant=is_significant,
            is_trigger=is_trigger,
            avg_bristol_when_eaten=avg_when_eaten,
            avg_bristol_when_not_eaten=avg_when_not_eaten,
        )
