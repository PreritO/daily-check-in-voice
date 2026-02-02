"""Tool executor for nutrition chat agent.

Executes agent tool calls against the database and returns structured results.
"""

from datetime import date, datetime, timedelta
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import BiometricLog, ExerciseLog, FoodLog, HealthNote
from src.services.food_correlation_service import (
    FoodCorrelationService,
)
from src.services.food_correlation_service import (
    InsufficientDataError as FoodInsufficientDataError,
)
from src.services.insights_service import (
    TRACKED_NUTRIENTS,
    InsightsService,
)
from src.services.insights_service import (
    InsufficientDataError as InsightsInsufficientDataError,
)

logger = structlog.get_logger()


class ToolExecutionError(Exception):
    """Raised when tool execution fails."""

    pass


class ToolExecutor:
    """Executes agent tool calls against the database."""

    def __init__(self, db: AsyncSession, user_id: UUID) -> None:
        """Initialize the tool executor.

        Args:
            db: Async database session.
            user_id: UUID of the user whose data to query.
        """
        self.db = db
        self.user_id = user_id
        self.logger = logger.bind(service="tool_executor", user_id=str(user_id))

        # Map tool names to methods
        self._tool_handlers: dict[str, Any] = {
            "get_food_logs": self._get_food_logs,
            "get_daily_nutrition_summary": self._get_daily_nutrition_summary,
            "get_bowel_movements": self._get_bowel_movements,
            "get_exercises": self._get_exercises,
            "get_biometrics": self._get_biometrics,
            "get_health_notes": self._get_health_notes,
            "get_trigger_foods": self._get_trigger_foods,
            "get_nutrient_correlations": self._get_nutrient_correlations,
            "compare_days": self._compare_days,
        }

    async def execute(self, tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
        """Execute a tool call and return the result.

        Args:
            tool_name: Name of the tool to execute.
            args: Arguments for the tool.

        Returns:
            Dict containing the tool result or error message.
        """
        handler = self._tool_handlers.get(tool_name)
        if not handler:
            self.logger.warning("unknown_tool", tool_name=tool_name)
            return {"error": f"Unknown tool: {tool_name}"}

        try:
            self.logger.info("executing_tool", tool_name=tool_name, args=args)
            result = await handler(args)
            self.logger.info("tool_completed", tool_name=tool_name)
            return result
        except ValueError as e:
            # Date parsing errors
            self.logger.warning("tool_value_error", tool_name=tool_name, error=str(e))
            return {"error": f"Invalid argument: {e}"}
        except Exception as e:
            self.logger.exception("tool_execution_error", tool_name=tool_name)
            return {"error": f"Tool execution failed: {e}"}

    def _parse_date(self, date_str: str) -> date:
        """Parse a date string in YYYY-MM-DD format.

        Args:
            date_str: Date string to parse.

        Returns:
            Parsed date object.

        Raises:
            ValueError: If date string is invalid.
        """
        return date.fromisoformat(date_str)

    def _date_to_datetime_range(
        self, start_date: date, end_date: date
    ) -> tuple[datetime, datetime]:
        """Convert date range to datetime range for queries.

        Args:
            start_date: Start date (inclusive).
            end_date: End date (inclusive).

        Returns:
            Tuple of (start_datetime, end_datetime).
        """
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())
        return start_dt, end_dt

    async def _get_food_logs(self, args: dict[str, Any]) -> dict[str, Any]:
        """Get food logs for a date range.

        Args:
            args: Tool arguments with start_date, end_date, optional food_group and limit.

        Returns:
            Dict with count and list of food logs.
        """
        start_date = self._parse_date(args["start_date"])
        end_date = self._parse_date(args["end_date"])
        food_group = args.get("food_group")
        limit = min(args.get("limit", 50), 200)  # Cap at 200

        start_dt, end_dt = self._date_to_datetime_range(start_date, end_date)

        stmt = (
            select(FoodLog)
            .where(FoodLog.user_id == self.user_id)
            .where(FoodLog.logged_at >= start_dt)
            .where(FoodLog.logged_at <= end_dt)
            .order_by(FoodLog.logged_at.desc())
            .limit(limit)
        )

        if food_group:
            stmt = stmt.where(FoodLog.food_group == food_group)

        result = await self.db.execute(stmt)
        logs = result.scalars().all()

        return {
            "count": len(logs),
            "food_logs": [
                {
                    "id": str(log.id),
                    "logged_at": log.logged_at.isoformat() if log.logged_at else None,
                    "food_name": log.food_name,
                    "serving_size": log.serving_size,
                    "food_group": log.food_group,
                    "calories": log.calories,
                    "protein_g": log.protein_g,
                    "carbs_g": log.carbs_g,
                    "fat_g": log.fat_g,
                    "fiber_g": log.fiber_g,
                    "sugar_g": log.sugar_g,
                    "sodium_mg": log.sodium_mg,
                }
                for log in logs
            ],
        }

    async def _get_daily_nutrition_summary(self, args: dict[str, Any]) -> dict[str, Any]:
        """Get aggregated nutrition totals for a specific date.

        Args:
            args: Tool arguments with date and optional include_detailed_nutrients.

        Returns:
            Dict with aggregated nutrition data.
        """
        target_date = self._parse_date(args["date"])
        include_detailed = args.get("include_detailed_nutrients", False)

        start_dt, end_dt = self._date_to_datetime_range(target_date, target_date)

        result = await self.db.execute(
            select(FoodLog)
            .where(FoodLog.user_id == self.user_id)
            .where(FoodLog.logged_at >= start_dt)
            .where(FoodLog.logged_at <= end_dt)
        )
        logs = list(result.scalars().all())

        # Aggregate base macros
        totals: dict[str, Any] = {
            "date": target_date.isoformat(),
            "food_count": len(logs),
            "calories": sum(log.calories or 0 for log in logs),
            "protein_g": round(sum(log.protein_g or 0 for log in logs), 1),
            "carbs_g": round(sum(log.carbs_g or 0 for log in logs), 1),
            "fat_g": round(sum(log.fat_g or 0 for log in logs), 1),
            "fiber_g": round(sum(log.fiber_g or 0 for log in logs), 1),
            "sugar_g": round(sum(log.sugar_g or 0 for log in logs), 1),
            "sodium_mg": round(sum(log.sodium_mg or 0 for log in logs), 1),
        }

        if include_detailed and logs:
            # Aggregate from raw_data JSON using TRACKED_NUTRIENTS keys
            detailed: dict[str, float] = {}
            for log in logs:
                if log.raw_data:
                    for key in TRACKED_NUTRIENTS:
                        value = log.raw_data.get(key)
                        if value is not None:
                            try:
                                detailed[key] = detailed.get(key, 0) + float(value)
                            except (TypeError, ValueError):
                                continue
            # Round all detailed values
            totals["detailed_nutrients"] = {k: round(v, 2) for k, v in detailed.items()}

        return totals

    async def _get_bowel_movements(self, args: dict[str, Any]) -> dict[str, Any]:
        """Get bowel movement data for a date range.

        Args:
            args: Tool arguments with start_date, end_date, optional include_notes.

        Returns:
            Dict with count and list of bowel movements.
        """
        start_date = self._parse_date(args["start_date"])
        end_date = self._parse_date(args["end_date"])
        include_notes = args.get("include_notes", False)

        start_dt, end_dt = self._date_to_datetime_range(start_date, end_date)

        stmt = (
            select(HealthNote)
            .where(HealthNote.user_id == self.user_id)
            .where(HealthNote.is_bowel_movement.is_(True))
            .where(HealthNote.logged_at >= start_dt)
            .where(HealthNote.logged_at <= end_dt)
            .order_by(HealthNote.logged_at.desc())
        )

        result = await self.db.execute(stmt)
        notes = result.scalars().all()

        movements = []
        for note in notes:
            movement: dict[str, Any] = {
                "id": str(note.id),
                "logged_at": note.logged_at.isoformat() if note.logged_at else None,
                "bristol_scale": note.bristol_scale,
                "quantity_score": note.quantity_score,
            }
            if include_notes and note.content:
                movement["notes"] = note.content
            movements.append(movement)

        return {
            "count": len(movements),
            "bowel_movements": movements,
        }

    async def _get_exercises(self, args: dict[str, Any]) -> dict[str, Any]:
        """Get exercise data for a date range.

        Args:
            args: Tool arguments with start_date, end_date, optional exercise_type.

        Returns:
            Dict with count and list of exercises.
        """
        start_date = self._parse_date(args["start_date"])
        end_date = self._parse_date(args["end_date"])
        exercise_type = args.get("exercise_type")

        start_dt, end_dt = self._date_to_datetime_range(start_date, end_date)

        stmt = (
            select(ExerciseLog)
            .where(ExerciseLog.user_id == self.user_id)
            .where(ExerciseLog.logged_at >= start_dt)
            .where(ExerciseLog.logged_at <= end_dt)
            .order_by(ExerciseLog.logged_at.desc())
        )

        if exercise_type:
            stmt = stmt.where(ExerciseLog.name.ilike(f"%{exercise_type}%"))

        result = await self.db.execute(stmt)
        logs = result.scalars().all()

        return {
            "count": len(logs),
            "exercises": [
                {
                    "id": str(log.id),
                    "logged_at": log.logged_at.isoformat() if log.logged_at else None,
                    "name": log.name,
                    "duration_minutes": log.duration_minutes,
                    "calories_burned": log.calories_burned,
                }
                for log in logs
            ],
        }

    async def _get_biometrics(self, args: dict[str, Any]) -> dict[str, Any]:
        """Get biometric measurements for a date range.

        Args:
            args: Tool arguments with start_date, end_date, optional metric_type.

        Returns:
            Dict with count and list of biometrics.
        """
        start_date = self._parse_date(args["start_date"])
        end_date = self._parse_date(args["end_date"])
        metric_type = args.get("metric_type")

        start_dt, end_dt = self._date_to_datetime_range(start_date, end_date)

        stmt = (
            select(BiometricLog)
            .where(BiometricLog.user_id == self.user_id)
            .where(BiometricLog.logged_at >= start_dt)
            .where(BiometricLog.logged_at <= end_dt)
            .order_by(BiometricLog.logged_at.desc())
        )

        if metric_type:
            stmt = stmt.where(BiometricLog.metric_type == metric_type)

        result = await self.db.execute(stmt)
        logs = result.scalars().all()

        return {
            "count": len(logs),
            "biometrics": [
                {
                    "id": str(log.id),
                    "logged_at": log.logged_at.isoformat() if log.logged_at else None,
                    "metric_type": log.metric_type,
                    "value": log.value,
                    "unit": log.unit,
                }
                for log in logs
            ],
        }

    async def _get_health_notes(self, args: dict[str, Any]) -> dict[str, Any]:
        """Get health notes (excluding bowel movements) for a date range.

        Args:
            args: Tool arguments with start_date, end_date, optional search_term.

        Returns:
            Dict with count and list of health notes.
        """
        start_date = self._parse_date(args["start_date"])
        end_date = self._parse_date(args["end_date"])
        search_term = args.get("search_term")

        start_dt, end_dt = self._date_to_datetime_range(start_date, end_date)

        stmt = (
            select(HealthNote)
            .where(HealthNote.user_id == self.user_id)
            .where(HealthNote.is_bowel_movement.is_(False))
            .where(HealthNote.logged_at >= start_dt)
            .where(HealthNote.logged_at <= end_dt)
            .order_by(HealthNote.logged_at.desc())
        )

        if search_term:
            stmt = stmt.where(HealthNote.content.ilike(f"%{search_term}%"))

        result = await self.db.execute(stmt)
        notes = result.scalars().all()

        return {
            "count": len(notes),
            "health_notes": [
                {
                    "id": str(note.id),
                    "logged_at": note.logged_at.isoformat() if note.logged_at else None,
                    "content": note.content,
                }
                for note in notes
            ],
        }

    async def _get_trigger_foods(self, args: dict[str, Any]) -> dict[str, Any]:
        """Analyze which foods correlate with poor digestive outcomes.

        Args:
            args: Tool arguments with start_date, end_date, optional min_occurrences
                and time_lag_hours.

        Returns:
            Dict with trigger foods analysis results.
        """
        start_date = self._parse_date(args["start_date"])
        end_date = self._parse_date(args["end_date"])
        min_occurrences = args.get("min_occurrences", 3)
        time_lag_hours = args.get("time_lag_hours", 24)

        service = FoodCorrelationService(self.db)

        try:
            result = await service.analyze_foods(
                user_id=self.user_id,
                start_date=start_date,
                end_date=end_date,
                min_occurrences=min_occurrences,
                time_lag_hours=time_lag_hours,
            )

            return {
                "total_foods_analyzed": result.total_foods_analyzed,
                "total_food_logs": result.total_food_logs,
                "total_bristol_events": result.total_bristol_events,
                "trigger_foods": [
                    {
                        "food_name": tf.food_name,
                        "times_eaten": tf.times_eaten,
                        "avg_bristol_after": tf.avg_bristol_after,
                        "correlation": round(tf.correlation, 3),
                        "is_significant": tf.is_significant,
                    }
                    for tf in result.trigger_foods[:20]  # Limit for LLM context
                ],
            }
        except FoodInsufficientDataError as e:
            return {"error": str(e), "trigger_foods": []}

    async def _get_nutrient_correlations(self, args: dict[str, Any]) -> dict[str, Any]:
        """Find correlations between nutrient intake and digestive outcomes.

        Args:
            args: Tool arguments with start_date, end_date, optional analysis_level
                and nutrient_filter.

        Returns:
            Dict with nutrient correlation analysis results.
        """
        start_date = self._parse_date(args["start_date"])
        end_date = self._parse_date(args["end_date"])
        analysis_level = args.get("analysis_level", "standard")
        nutrient_filter = args.get("nutrient_filter")

        service = InsightsService(self.db)

        try:
            result = await service.analyze_correlations(
                user_id=self.user_id,
                start_date=start_date,
                end_date=end_date,
                analysis_level=analysis_level,
            )

            # Extract significant correlations
            correlations = []
            for _lag, results in result.results_by_lag.items():
                for r in results:
                    if nutrient_filter and nutrient_filter.lower() not in r.nutrient_name.lower():
                        continue
                    if r.is_significant:
                        correlations.append(
                            {
                                "nutrient": r.nutrient_name,
                                "time_lag_hours": r.time_lag_hours,
                                "correlation": r.correlation_coefficient,
                                "direction": r.direction,
                                "interpretation": r.interpretation,
                            }
                        )

            return {
                "baseline_bristol": result.baseline_bristol_score,
                "total_bowel_movements": result.total_bowel_movements,
                "total_food_logs": result.total_food_logs,
                "significant_correlations": correlations[:20],  # Limit for LLM context
                "insights": result.insights,
            }
        except InsightsInsufficientDataError as e:
            return {"error": str(e), "significant_correlations": []}

    async def _compare_days(self, args: dict[str, Any]) -> dict[str, Any]:
        """Compare nutrition and outcomes between two periods or good vs bad days.

        Args:
            args: Tool arguments with period1_start, period1_end, optional period2_start,
                period2_end, compare_mode, and metrics.

        Returns:
            Dict with comparison results.
        """
        period1_start = self._parse_date(args["period1_start"])
        period1_end = self._parse_date(args["period1_end"])
        compare_mode = args.get("compare_mode", "periods")
        metrics = args.get("metrics", ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g"])

        if compare_mode == "good_vs_bad_days":
            return await self._compare_good_vs_bad_days(period1_start, period1_end, metrics)
        else:
            # Period comparison mode requires period2 dates
            period2_start_str = args.get("period2_start")
            period2_end_str = args.get("period2_end")

            if not period2_start_str or not period2_end_str:
                return {"error": "period2_start and period2_end are required for periods mode"}

            period2_start = self._parse_date(period2_start_str)
            period2_end = self._parse_date(period2_end_str)

            return await self._compare_two_periods(
                period1_start, period1_end, period2_start, period2_end, metrics
            )

    async def _compare_good_vs_bad_days(
        self, start_date: date, end_date: date, metrics: list[str]
    ) -> dict[str, Any]:
        """Compare days with good Bristol scores (3-5) vs bad scores (<3 or >5).

        Args:
            start_date: Start date for analysis.
            end_date: End date for analysis.
            metrics: List of metric names to compare.

        Returns:
            Dict with comparison results.
        """
        start_dt, end_dt = self._date_to_datetime_range(start_date, end_date)

        # Get all bowel movements in range
        bm_result = await self.db.execute(
            select(HealthNote)
            .where(HealthNote.user_id == self.user_id)
            .where(HealthNote.is_bowel_movement.is_(True))
            .where(HealthNote.bristol_scale.isnot(None))
            .where(HealthNote.logged_at >= start_dt)
            .where(HealthNote.logged_at <= end_dt)
        )
        bm_notes = list(bm_result.scalars().all())

        if len(bm_notes) < 5:
            return {"error": "Not enough bowel movement data (need at least 5)"}

        # Group days by good vs bad Bristol scores
        good_days: set[date] = set()
        bad_days: set[date] = set()

        for note in bm_notes:
            if note.logged_at and note.bristol_scale:
                day = note.logged_at.date()
                if 3 <= note.bristol_scale <= 5:
                    good_days.add(day)
                else:
                    bad_days.add(day)

        # Remove days that have both good and bad (ambiguous)
        ambiguous = good_days & bad_days
        good_days -= ambiguous
        bad_days -= ambiguous

        if len(good_days) < 2 or len(bad_days) < 2:
            return {
                "error": "Not enough clearly good or bad days for comparison",
                "good_days_count": len(good_days),
                "bad_days_count": len(bad_days),
            }

        # Calculate average metrics for good days
        good_totals = await self._calculate_day_averages(list(good_days), metrics)
        bad_totals = await self._calculate_day_averages(list(bad_days), metrics)

        # Calculate differences
        differences: dict[str, float] = {}
        for metric in metrics:
            good_val = good_totals.get(metric, 0)
            bad_val = bad_totals.get(metric, 0)
            if bad_val != 0:
                differences[metric] = round(((good_val - bad_val) / bad_val) * 100, 1)
            else:
                differences[metric] = 0

        return {
            "compare_mode": "good_vs_bad_days",
            "good_days_count": len(good_days),
            "bad_days_count": len(bad_days),
            "good_days_average": good_totals,
            "bad_days_average": bad_totals,
            "percentage_differences": differences,
            "interpretation": self._interpret_comparison(differences),
        }

    async def _compare_two_periods(
        self,
        period1_start: date,
        period1_end: date,
        period2_start: date,
        period2_end: date,
        metrics: list[str],
    ) -> dict[str, Any]:
        """Compare nutrition between two time periods.

        Args:
            period1_start: Start of first period.
            period1_end: End of first period.
            period2_start: Start of second period.
            period2_end: End of second period.
            metrics: List of metric names to compare.

        Returns:
            Dict with comparison results.
        """
        # Generate list of days for each period
        period1_days = []
        current = period1_start
        while current <= period1_end:
            period1_days.append(current)
            current = current + timedelta(days=1)

        period2_days = []
        current = period2_start
        while current <= period2_end:
            period2_days.append(current)
            current = current + timedelta(days=1)

        # Calculate averages for each period
        period1_avg = await self._calculate_day_averages(period1_days, metrics)
        period2_avg = await self._calculate_day_averages(period2_days, metrics)

        # Calculate differences
        differences: dict[str, float] = {}
        for metric in metrics:
            p1_val = period1_avg.get(metric, 0)
            p2_val = period2_avg.get(metric, 0)
            if p2_val != 0:
                differences[metric] = round(((p1_val - p2_val) / p2_val) * 100, 1)
            else:
                differences[metric] = 0

        return {
            "compare_mode": "periods",
            "period1": {
                "start": period1_start.isoformat(),
                "end": period1_end.isoformat(),
                "days": len(period1_days),
                "averages": period1_avg,
            },
            "period2": {
                "start": period2_start.isoformat(),
                "end": period2_end.isoformat(),
                "days": len(period2_days),
                "averages": period2_avg,
            },
            "percentage_differences": differences,
        }

    async def _calculate_day_averages(
        self, days: list[date], metrics: list[str]
    ) -> dict[str, float]:
        """Calculate average nutrition metrics across a list of days.

        Args:
            days: List of dates to analyze.
            metrics: List of metric names to aggregate.

        Returns:
            Dict of metric name to average value.
        """
        if not days:
            return {metric: 0 for metric in metrics}

        # Build metric name to model field mapping
        metric_to_field = {
            "calories": FoodLog.calories,
            "protein_g": FoodLog.protein_g,
            "carbs_g": FoodLog.carbs_g,
            "fat_g": FoodLog.fat_g,
            "fiber_g": FoodLog.fiber_g,
            "sugar_g": FoodLog.sugar_g,
            "sodium_mg": FoodLog.sodium_mg,
        }

        totals: dict[str, float] = {metric: 0 for metric in metrics}

        for day in days:
            start_dt, end_dt = self._date_to_datetime_range(day, day)

            # Get food logs for this day
            result = await self.db.execute(
                select(FoodLog)
                .where(FoodLog.user_id == self.user_id)
                .where(FoodLog.logged_at >= start_dt)
                .where(FoodLog.logged_at <= end_dt)
            )
            logs = result.scalars().all()

            # Sum metrics for this day
            for log in logs:
                for metric in metrics:
                    field = metric_to_field.get(metric)
                    if field is not None:
                        value = getattr(log, metric, None)
                        if value is not None:
                            totals[metric] += value

        # Calculate averages
        num_days = len(days)
        return {metric: round(total / num_days, 1) for metric, total in totals.items()}

    def _interpret_comparison(self, differences: dict[str, float]) -> str:
        """Generate a human-readable interpretation of comparison differences.

        Args:
            differences: Dict of metric name to percentage difference.

        Returns:
            Interpretation string.
        """
        insights = []

        for metric, diff in differences.items():
            if abs(diff) < 5:
                continue  # Skip negligible differences

            metric_display = metric.replace("_", " ").replace(" g", "").replace(" mg", "")

            if diff > 0:
                insights.append(f"Good days have {abs(diff):.0f}% more {metric_display}")
            else:
                insights.append(f"Good days have {abs(diff):.0f}% less {metric_display}")

        if not insights:
            return "No significant differences found between good and bad days."

        return " | ".join(insights[:5])  # Limit to 5 insights
