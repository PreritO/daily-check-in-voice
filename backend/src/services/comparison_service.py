"""Controlled comparison service for comparing Bristol outcomes with/without high nutrient intake."""

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

import numpy as np
import structlog
from scipy import stats
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import FoodLog, HealthNote

logger = structlog.get_logger()


@dataclass
class ComparisonResult:
    """Result of controlled comparison."""

    nutrient_key: str
    nutrient_name: str
    avg_bristol_high_intake: float
    avg_bristol_low_intake: float
    difference: float  # high - low
    confidence_interval_low: float  # 95% CI lower bound
    confidence_interval_high: float  # 95% CI upper bound
    high_intake_count: int  # sample size for high intake days
    low_intake_count: int  # sample size for low intake days
    matched_pairs_count: int  # number of matched day-pairs
    is_significant: bool  # True if CI doesn't include 0


class InsufficientMatchesError(Exception):
    """Raised when not enough matched pairs can be found."""


class ControlledComparisonService:
    """Service for controlled comparison of Bristol outcomes."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def compare(
        self,
        user_id: UUID,
        nutrient_key: str,
        start_date: date,
        end_date: date,
        control_factors: list[str] | None = None,
        min_matched_pairs: int = 5,
    ) -> ComparisonResult:
        """Compare Bristol outcomes on high vs low nutrient intake days.

        Uses simple quartile matching:
        1. Split days into high (top quartile) and low (bottom quartile) nutrient intake
        2. For control factors, match days within similar ranges
        3. Compare average Bristol scores between groups
        4. Calculate confidence interval for the difference

        Args:
            user_id: User ID
            nutrient_key: Nutrient to analyze (e.g., "fiber_g")
            start_date: Start of analysis period
            end_date: End of analysis period
            control_factors: Other nutrients to control for (e.g., ["calories", "protein_g"])
            min_matched_pairs: Minimum number of matched pairs required

        Returns:
            ComparisonResult with statistics

        Raises:
            InsufficientMatchesError: If not enough matches found
        """
        if control_factors is None:
            control_factors = ["calories"]  # Default control

        # 1. Get daily data (nutrients + Bristol)
        daily_data = await self._get_daily_data(
            user_id, nutrient_key, control_factors, start_date, end_date
        )

        if len(daily_data) < min_matched_pairs * 2:
            raise InsufficientMatchesError(
                f"Insufficient data: {len(daily_data)} days, need at least {min_matched_pairs * 2}"
            )

        # 2. Split into high/low based on target nutrient (quartiles)
        nutrient_values = [d["nutrient"] for d in daily_data]
        q75 = np.percentile(nutrient_values, 75)
        q25 = np.percentile(nutrient_values, 25)

        high_days = [d for d in daily_data if d["nutrient"] >= q75]
        low_days = [d for d in daily_data if d["nutrient"] <= q25]

        # 3. Simple matching based on control factors
        # For each control factor, match days within similar quartile
        matched_high = []
        matched_low = []

        # Simple approach: match high days to similar low days
        for high_day in high_days:
            # Find a low day with similar control factor values
            for low_day in low_days:
                if low_day in matched_low:
                    continue  # Already matched
                if self._is_similar(high_day, low_day, control_factors, daily_data):
                    matched_high.append(high_day)
                    matched_low.append(low_day)
                    break

        if len(matched_high) < min_matched_pairs:
            raise InsufficientMatchesError(
                f"Only {len(matched_high)} matched pairs found, need at least {min_matched_pairs}"
            )

        # 4. Calculate statistics
        high_bristols = [d["bristol"] for d in matched_high]
        low_bristols = [d["bristol"] for d in matched_low]

        avg_high = np.mean(high_bristols)
        avg_low = np.mean(low_bristols)
        diff = avg_high - avg_low

        # 95% CI using t-test for paired samples
        if len(matched_high) > 1:
            _, p_value = stats.ttest_ind(high_bristols, low_bristols)
            se = np.sqrt(
                np.var(high_bristols) / len(high_bristols)
                + np.var(low_bristols) / len(low_bristols)
            )
            ci_low = diff - 1.96 * se
            ci_high = diff + 1.96 * se
            is_significant = p_value < 0.05
        else:
            ci_low = diff
            ci_high = diff
            is_significant = False

        nutrient_name = nutrient_key.replace("_", " ").title()

        return ComparisonResult(
            nutrient_key=nutrient_key,
            nutrient_name=nutrient_name,
            avg_bristol_high_intake=float(avg_high),
            avg_bristol_low_intake=float(avg_low),
            difference=float(diff),
            confidence_interval_low=float(ci_low),
            confidence_interval_high=float(ci_high),
            high_intake_count=len(matched_high),
            low_intake_count=len(matched_low),
            matched_pairs_count=len(matched_high),
            is_significant=is_significant,
        )

    async def _get_daily_data(
        self,
        user_id: UUID,
        nutrient_key: str,
        control_factors: list[str],
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """Get daily aggregated data for nutrient, controls, and Bristol."""
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())

        # Get food logs
        food_result = await self.db.execute(
            select(FoodLog)
            .where(FoodLog.user_id == user_id)
            .where(FoodLog.logged_at >= start_dt)
            .where(FoodLog.logged_at <= end_dt)
        )
        food_logs = food_result.scalars().all()

        # Get Bristol scores
        bristol_result = await self.db.execute(
            select(HealthNote)
            .where(HealthNote.user_id == user_id)
            .where(HealthNote.is_bowel_movement == True)  # noqa: E712
            .where(HealthNote.bristol_scale.isnot(None))
            .where(HealthNote.logged_at >= start_dt)
            .where(HealthNote.logged_at <= end_dt)
        )
        bristol_notes = bristol_result.scalars().all()

        # Aggregate by day
        all_fields = [nutrient_key] + control_factors
        daily_nutrients: dict[date, dict[str, float]] = {}

        for log in food_logs:
            d = log.logged_at.date()
            if d not in daily_nutrients:
                daily_nutrients[d] = {f: 0.0 for f in all_fields}

            for field in all_fields:
                value = getattr(log, field, None)
                if value is None and log.raw_data:
                    value = log.raw_data.get(field, 0.0)
                if value is not None:
                    daily_nutrients[d][field] += float(value)

        # Aggregate Bristol by day
        daily_bristol: dict[date, list[int]] = {}
        for note in bristol_notes:
            d = note.logged_at.date()
            if d not in daily_bristol:
                daily_bristol[d] = []
            daily_bristol[d].append(note.bristol_scale)

        # Combine - only days with both nutrient and Bristol data
        common_dates = set(daily_nutrients.keys()) & set(daily_bristol.keys())

        result = []
        for d in common_dates:
            avg_bristol = sum(daily_bristol[d]) / len(daily_bristol[d])
            entry = {
                "date": d,
                "nutrient": daily_nutrients[d][nutrient_key],
                "bristol": avg_bristol,
            }
            for cf in control_factors:
                entry[cf] = daily_nutrients[d].get(cf, 0.0)
            result.append(entry)

        return result

    def _is_similar(
        self, day1: dict, day2: dict, control_factors: list[str], all_data: list[dict]
    ) -> bool:
        """Check if two days are similar based on control factors (within same quartile)."""
        for cf in control_factors:
            values = [d[cf] for d in all_data]
            q25, q50, q75 = np.percentile(values, [25, 50, 75])

            quartile1 = self._get_quartile(day1[cf], q25, q50, q75)
            quartile2 = self._get_quartile(day2[cf], q25, q50, q75)

            if quartile1 != quartile2:
                return False

        return True

    def _get_quartile(self, value: float, q25: float, q50: float, q75: float) -> int:
        """Get quartile (1-4) for a value based on percentile boundaries."""
        if value <= q25:
            return 1
        elif value <= q50:
            return 2
        elif value <= q75:
            return 3
        return 4
