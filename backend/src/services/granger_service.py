"""Granger causality service for testing if nutrient intake predicts Bristol outcomes."""

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

import numpy as np
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from statsmodels.tsa.stattools import grangercausalitytests

from src.models import FoodLog, HealthNote

logger = structlog.get_logger()


@dataclass
class GrangerResult:
    """Result of Granger causality test for a nutrient."""

    nutrient_key: str
    nutrient_name: str
    f_statistic: float
    p_value: float
    optimal_lag: int  # The lag (in days) with strongest causality
    is_causal: bool  # True if p < 0.05


class InsufficientDataError(Exception):
    """Raised when there isn't enough consecutive daily data for Granger test."""

    pass


class GrangerCausalityService:
    """Service for testing Granger causality between nutrients and Bristol scores."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def test_causality(
        self,
        user_id: UUID,
        nutrient_key: str,
        start_date: date,
        end_date: date,
        max_lag_days: int = 3,
    ) -> GrangerResult:
        """Test if past nutrient intake Granger-causes Bristol scores.

        Args:
            user_id: The user's ID
            nutrient_key: The nutrient to test (e.g., "fiber_g")
            start_date: Start of analysis period
            end_date: End of analysis period
            max_lag_days: Maximum lag to test (1-5 typical)

        Returns:
            GrangerResult with test statistics

        Raises:
            InsufficientDataError: If not enough consecutive daily data
        """
        # 1. Get daily Bristol scores (average if multiple per day)
        # 2. Get daily nutrient totals
        # 3. Build aligned time series (only dates with both values)
        # 4. Run grangercausalitytests
        # 5. Find best lag and return results

        # Fetch health notes with Bristol scores
        bristol_data = await self._get_daily_bristol(user_id, start_date, end_date)

        # Fetch nutrient data
        nutrient_data = await self._get_daily_nutrient(user_id, nutrient_key, start_date, end_date)

        # Build aligned series
        aligned_data = self._align_series(bristol_data, nutrient_data)

        if len(aligned_data) < max_lag_days + 5:  # Need sufficient observations
            raise InsufficientDataError(
                f"Insufficient data for Granger test: {len(aligned_data)} observations, "
                f"need at least {max_lag_days + 5}"
            )

        # Prepare data for statsmodels (2D array: [[bristol, nutrient], ...])
        # grangercausalitytests expects column 0 as Y (effect) and column 1 as X (cause)
        data = np.array([[d["bristol"], d["nutrient"]] for d in aligned_data])

        # Run Granger test - this tests if column 1 Granger-causes column 0
        try:
            results = grangercausalitytests(data, maxlag=max_lag_days, verbose=False)
        except Exception as e:
            logger.warning("Granger test failed", error=str(e), nutrient_key=nutrient_key)
            raise InsufficientDataError(f"Granger test failed: {e}") from e

        # Find best lag (lowest p-value)
        best_lag = 1
        best_p = 1.0
        best_f = 0.0

        for lag in range(1, max_lag_days + 1):
            # results[lag][0] contains test statistics
            # 'ssr_ftest' is the F-test result: (F-stat, p-value, df_denom, df_num)
            f_stat, p_val, _, _ = results[lag][0]["ssr_ftest"]
            if p_val < best_p:
                best_p = p_val
                best_f = f_stat
                best_lag = lag

        # Map nutrient_key to friendly name
        nutrient_name = nutrient_key.replace("_", " ").title()

        return GrangerResult(
            nutrient_key=nutrient_key,
            nutrient_name=nutrient_name,
            f_statistic=float(best_f),
            p_value=float(best_p),
            optimal_lag=best_lag,
            is_causal=best_p < 0.05,
        )

    async def _get_daily_bristol(
        self, user_id: UUID, start_date: date, end_date: date
    ) -> dict[date, float]:
        """Get daily average Bristol scores."""
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())

        result = await self.db.execute(
            select(HealthNote)
            .where(HealthNote.user_id == user_id)
            .where(HealthNote.is_bowel_movement == True)  # noqa: E712
            .where(HealthNote.bristol_scale.isnot(None))
            .where(HealthNote.logged_at >= start_dt)
            .where(HealthNote.logged_at <= end_dt)
        )
        notes = result.scalars().all()

        # Group by date and average
        daily: dict[date, list[int]] = {}
        for note in notes:
            d = note.logged_at.date()
            if d not in daily:
                daily[d] = []
            daily[d].append(note.bristol_scale)

        return {d: sum(scores) / len(scores) for d, scores in daily.items()}

    async def _get_daily_nutrient(
        self, user_id: UUID, nutrient_key: str, start_date: date, end_date: date
    ) -> dict[date, float]:
        """Get daily total for a nutrient."""
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())

        result = await self.db.execute(
            select(FoodLog)
            .where(FoodLog.user_id == user_id)
            .where(FoodLog.logged_at >= start_dt)
            .where(FoodLog.logged_at <= end_dt)
        )
        logs = result.scalars().all()

        # Group by date and sum
        daily: dict[date, float] = {}
        for log in logs:
            d = log.logged_at.date()

            # Try model field first, then raw_data
            value = getattr(log, nutrient_key, None)
            if value is None and log.raw_data:
                value = log.raw_data.get(nutrient_key, 0.0)
            if value is None:
                value = 0.0

            if d not in daily:
                daily[d] = 0.0
            daily[d] += float(value)

        return daily

    def _align_series(self, bristol: dict[date, float], nutrient: dict[date, float]) -> list[dict]:
        """Align two time series to common dates, sorted chronologically."""
        common_dates = sorted(set(bristol.keys()) & set(nutrient.keys()))

        return [{"date": d, "bristol": bristol[d], "nutrient": nutrient[d]} for d in common_dates]
