"""Optimal ranges service for finding personalized nutrient intake ranges."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from uuid import UUID

import numpy as np
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import FoodLog, HealthNote
from src.services.insights_service import TRACKED_NUTRIENTS

logger = structlog.get_logger()


class InsufficientDataError(Exception):
    """Raised when there isn't enough data for meaningful analysis."""

    pass


@dataclass
class OptimalRange:
    """Optimal intake range for a nutrient."""

    nutrient_name: str
    nutrient_key: str
    optimal_min: float
    optimal_max: float
    avg_bristol_in_range: float
    sample_size: int
    confidence_score: float  # 0-1 based on sample size and consistency
    unit: str


@dataclass
class OptimalRangesResponse:
    """Response containing optimal ranges for all analyzable nutrients."""

    total_nutrients_analyzed: int
    total_food_logs: int
    total_bristol_events: int
    target_bristol: float
    tolerance: float
    analysis_start_date: date
    analysis_end_date: date
    ranges: list[OptimalRange]


# Nutrient units for display
NUTRIENT_UNITS: dict[str, str] = {
    "calories": "kcal",
    "protein": "g",
    "carbs": "g",
    "fat": "g",
    "fiber": "g",
    "sugar": "g",
    "sodium": "mg",
    "saturated_fat": "g",
    "monounsaturated_fat": "g",
    "polyunsaturated_fat": "g",
    "omega_3": "g",
    "omega_6": "g",
    "cholesterol": "mg",
    "vitamin_a": "μg",
    "vitamin_c": "mg",
    "vitamin_d": "μg",
    "vitamin_e": "mg",
    "vitamin_k": "μg",
    "vitamin_b1": "mg",
    "vitamin_b2": "mg",
    "vitamin_b3": "mg",
    "vitamin_b5": "mg",
    "vitamin_b6": "mg",
    "vitamin_b7": "μg",
    "vitamin_b9": "μg",
    "vitamin_b12": "μg",
    "calcium": "mg",
    "iron": "mg",
    "magnesium": "mg",
    "phosphorus": "mg",
    "potassium": "mg",
    "zinc": "mg",
    "copper": "mg",
    "manganese": "mg",
    "selenium": "μg",
    "chromium": "μg",
    "water": "ml",
    "caffeine": "mg",
    "alcohol": "g",
}


class OptimalRangesService:
    """Service for finding personalized optimal nutrient ranges."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the service."""
        self.db = db

    async def find_optimal_ranges(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
        target_bristol: float = 4.0,
        tolerance: float = 1.0,
        min_samples: int = 5,
        time_lag_hours: int = 24,
    ) -> OptimalRangesResponse:
        """
        Find optimal intake ranges for each nutrient.

        Args:
            user_id: User ID to analyze
            start_date: Start of analysis period
            end_date: End of analysis period
            target_bristol: Target Bristol score (default 4, ideal)
            tolerance: Acceptable deviation from target (default 1)
            min_samples: Minimum samples per decile to include
            time_lag_hours: Hours after eating to check Bristol

        Returns:
            OptimalRangesResponse with optimal ranges per nutrient
        """
        # Fetch food logs
        food_logs = await self._get_food_logs(user_id, start_date, end_date)

        # Fetch Bristol events
        extended_end = end_date + timedelta(hours=time_lag_hours + 24)
        bristol_events = await self._get_bristol_events(user_id, start_date, extended_end)

        if len(bristol_events) < min_samples:
            raise InsufficientDataError(
                f"Need at least {min_samples} Bristol events, found {len(bristol_events)}"
            )

        logger.info(
            "finding_optimal_ranges",
            user_id=str(user_id),
            food_logs=len(food_logs),
            bristol_events=len(bristol_events),
            target_bristol=target_bristol,
        )

        # Aggregate daily nutrient totals
        daily_nutrients = self._aggregate_daily_nutrients(food_logs)

        # Match daily nutrients with Bristol events
        nutrient_bristol_pairs = self._match_nutrients_to_bristol(
            daily_nutrients, bristol_events, time_lag_hours
        )

        # Analyze each nutrient
        ranges: list[OptimalRange] = []
        for nutrient_key, nutrient_name in TRACKED_NUTRIENTS.items():
            result = self._analyze_nutrient_range(
                nutrient_key=nutrient_key,
                nutrient_name=nutrient_name,
                nutrient_bristol_pairs=nutrient_bristol_pairs,
                target_bristol=target_bristol,
                tolerance=tolerance,
                min_samples=min_samples,
            )
            if result is not None:
                ranges.append(result)

        # Sort by confidence score
        ranges.sort(key=lambda r: r.confidence_score, reverse=True)

        return OptimalRangesResponse(
            total_nutrients_analyzed=len(ranges),
            total_food_logs=len(food_logs),
            total_bristol_events=len(bristol_events),
            target_bristol=target_bristol,
            tolerance=tolerance,
            analysis_start_date=start_date,
            analysis_end_date=end_date,
            ranges=ranges,
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

    def _aggregate_daily_nutrients(self, food_logs: list[FoodLog]) -> dict[date, dict[str, float]]:
        """Aggregate nutrient totals by day."""
        daily: dict[date, dict[str, float]] = {}

        for log in food_logs:
            day = log.logged_at.date()
            if day not in daily:
                daily[day] = {}

            # Add basic nutrient fields
            nutrient_map = {
                "calories": log.calories,
                "protein": log.protein_g,
                "carbs": log.carbs_g,
                "fat": log.fat_g,
                "fiber": log.fiber_g,
                "sugar": log.sugar_g,
                "sodium": log.sodium_mg,
            }

            for key, value in nutrient_map.items():
                if value is not None:
                    daily[day][key] = daily[day].get(key, 0) + value

            # Add nutrients from raw_data if available
            if log.raw_data and isinstance(log.raw_data, dict):
                for nutrient_key in TRACKED_NUTRIENTS:
                    if nutrient_key in log.raw_data:
                        val = log.raw_data.get(nutrient_key)
                        if val is not None and isinstance(val, (int, float)):
                            daily[day][nutrient_key] = daily[day].get(nutrient_key, 0) + val

        return daily

    def _match_nutrients_to_bristol(
        self,
        daily_nutrients: dict[date, dict[str, float]],
        bristol_events: list[HealthNote],
        time_lag_hours: int,
    ) -> list[tuple[dict[str, float], int]]:
        """Match daily nutrient totals with Bristol events that follow."""
        pairs: list[tuple[dict[str, float], int]] = []

        for bristol_event in bristol_events:
            event_date = bristol_event.logged_at.date()
            # Look at food from the previous day based on time lag
            food_date = event_date - timedelta(days=1) if time_lag_hours >= 24 else event_date

            if food_date in daily_nutrients:
                pairs.append((daily_nutrients[food_date], bristol_event.bristol_scale))

        return pairs

    def _analyze_nutrient_range(
        self,
        nutrient_key: str,
        nutrient_name: str,
        nutrient_bristol_pairs: list[tuple[dict[str, float], int]],
        target_bristol: float,
        tolerance: float,
        min_samples: int,
    ) -> OptimalRange | None:
        """Analyze optimal range for a single nutrient using deciles."""
        # Extract nutrient values and Bristol scores
        values: list[float] = []
        bristols: list[int] = []

        for nutrients, bristol in nutrient_bristol_pairs:
            if nutrient_key in nutrients:
                values.append(nutrients[nutrient_key])
                bristols.append(bristol)

        if len(values) < min_samples * 3:
            return None  # Need enough data for meaningful analysis

        values_arr = np.array(values)
        bristols_arr = np.array(bristols)

        # Calculate decile boundaries
        try:
            decile_boundaries = np.percentile(values_arr, [10, 20, 30, 40, 50, 60, 70, 80, 90])
        except (ValueError, IndexError):
            return None

        # Find deciles with Bristol closest to target
        best_decile_start = 0
        best_decile_end = 0
        best_avg_bristol = 0.0
        best_sample_size = 0
        best_distance = float("inf")

        all_boundaries = [values_arr.min()] + list(decile_boundaries) + [values_arr.max()]

        for i in range(len(all_boundaries) - 1):
            low = all_boundaries[i]
            high = all_boundaries[i + 1]

            # Get Bristol scores in this range
            mask = (values_arr >= low) & (values_arr <= high)
            bristols_in_range = bristols_arr[mask]

            if len(bristols_in_range) < min_samples:
                continue

            avg_bristol = float(bristols_in_range.mean())
            distance = abs(avg_bristol - target_bristol)

            # Check if within tolerance and better than previous best
            if distance <= tolerance and distance < best_distance:
                best_distance = distance
                best_decile_start = low
                best_decile_end = high
                best_avg_bristol = avg_bristol
                best_sample_size = len(bristols_in_range)

        if best_sample_size == 0:
            return None

        # Calculate confidence score based on sample size and consistency
        sample_confidence = min(1.0, best_sample_size / 20)  # Max confidence at 20 samples
        target_confidence = 1.0 - (best_distance / tolerance) if tolerance > 0 else 1.0
        confidence_score = (sample_confidence + target_confidence) / 2

        return OptimalRange(
            nutrient_name=nutrient_name,
            nutrient_key=nutrient_key,
            optimal_min=float(best_decile_start),
            optimal_max=float(best_decile_end),
            avg_bristol_in_range=best_avg_bristol,
            sample_size=best_sample_size,
            confidence_score=confidence_score,
            unit=NUTRIENT_UNITS.get(nutrient_key, ""),
        )
