"""Unit tests for ToolExecutor class."""

from datetime import date, datetime
from uuid import uuid4

import pytest

from src.services.chat.tool_executor import ToolExecutionError, ToolExecutor


class TestParseDate:
    """Tests for _parse_date helper method."""

    @pytest.fixture
    def executor(self) -> ToolExecutor:
        """Create a ToolExecutor instance with None db."""
        return ToolExecutor(None, uuid4())  # type: ignore[arg-type]

    def test_valid_date_parsing(self, executor: ToolExecutor) -> None:
        """Test parsing valid YYYY-MM-DD date strings."""
        assert executor._parse_date("2024-01-15") == date(2024, 1, 15)
        assert executor._parse_date("2023-12-31") == date(2023, 12, 31)
        assert executor._parse_date("2024-02-29") == date(2024, 2, 29)  # Leap year

    def test_invalid_date_format(self, executor: ToolExecutor) -> None:
        """Test that invalid date formats raise ValueError."""
        with pytest.raises(ValueError):
            executor._parse_date("01-15-2024")  # Wrong format

        with pytest.raises(ValueError):
            executor._parse_date("2024/01/15")  # Wrong separator

        with pytest.raises(ValueError):
            executor._parse_date("not-a-date")  # Invalid string

    def test_invalid_date_values(self, executor: ToolExecutor) -> None:
        """Test that invalid date values raise ValueError."""
        with pytest.raises(ValueError):
            executor._parse_date("2024-13-01")  # Invalid month

        with pytest.raises(ValueError):
            executor._parse_date("2024-01-32")  # Invalid day

        with pytest.raises(ValueError):
            executor._parse_date("2023-02-29")  # Not a leap year


class TestDateToDatetimeRange:
    """Tests for _date_to_datetime_range helper method."""

    @pytest.fixture
    def executor(self) -> ToolExecutor:
        """Create a ToolExecutor instance with None db."""
        return ToolExecutor(None, uuid4())  # type: ignore[arg-type]

    def test_single_day_range(self, executor: ToolExecutor) -> None:
        """Test datetime range for a single day."""
        start_dt, end_dt = executor._date_to_datetime_range(date(2024, 1, 15), date(2024, 1, 15))

        assert start_dt == datetime(2024, 1, 15, 0, 0, 0)
        assert end_dt.date() == date(2024, 1, 15)
        assert end_dt.hour == 23
        assert end_dt.minute == 59
        assert end_dt.second == 59

    def test_multi_day_range(self, executor: ToolExecutor) -> None:
        """Test datetime range spanning multiple days."""
        start_dt, end_dt = executor._date_to_datetime_range(date(2024, 1, 1), date(2024, 1, 31))

        assert start_dt.date() == date(2024, 1, 1)
        assert start_dt.hour == 0
        assert end_dt.date() == date(2024, 1, 31)
        assert end_dt.hour == 23


class TestExecute:
    """Tests for the execute method."""

    @pytest.fixture
    def executor(self) -> ToolExecutor:
        """Create a ToolExecutor instance with None db."""
        return ToolExecutor(None, uuid4())  # type: ignore[arg-type]

    @pytest.mark.asyncio
    async def test_unknown_tool_returns_error(self, executor: ToolExecutor) -> None:
        """Test that executing an unknown tool returns an error dict."""
        result = await executor.execute("nonexistent_tool", {})

        assert "error" in result
        assert "Unknown tool" in result["error"]
        assert "nonexistent_tool" in result["error"]

    @pytest.mark.asyncio
    async def test_invalid_date_returns_error(self, executor: ToolExecutor) -> None:
        """Test that invalid dates return error dict."""
        result = await executor.execute(
            "get_food_logs", {"start_date": "invalid", "end_date": "2024-01-15"}
        )

        assert "error" in result
        assert "Invalid argument" in result["error"]

    @pytest.mark.asyncio
    async def test_missing_required_args_returns_error(self, executor: ToolExecutor) -> None:
        """Test that missing required arguments return error dict."""
        result = await executor.execute("get_food_logs", {})  # Missing start_date

        assert "error" in result
        # KeyError for missing key gets caught and returns error


class TestToolHandlerMapping:
    """Tests for tool handler mapping."""

    @pytest.fixture
    def executor(self) -> ToolExecutor:
        """Create a ToolExecutor instance with None db."""
        return ToolExecutor(None, uuid4())  # type: ignore[arg-type]

    def test_all_tools_have_handlers(self, executor: ToolExecutor) -> None:
        """Test that all expected tools have handlers defined."""
        expected_tools = [
            "get_food_logs",
            "get_daily_nutrition_summary",
            "get_bowel_movements",
            "get_exercises",
            "get_biometrics",
            "get_health_notes",
            "get_trigger_foods",
            "get_nutrient_correlations",
            "compare_days",
        ]

        for tool_name in expected_tools:
            assert tool_name in executor._tool_handlers
            assert callable(executor._tool_handlers[tool_name])

    def test_handler_count(self, executor: ToolExecutor) -> None:
        """Test that we have exactly 9 handlers (matching AGENT_TOOLS)."""
        assert len(executor._tool_handlers) == 9


class TestInterpretComparison:
    """Tests for _interpret_comparison helper method."""

    @pytest.fixture
    def executor(self) -> ToolExecutor:
        """Create a ToolExecutor instance with None db."""
        return ToolExecutor(None, uuid4())  # type: ignore[arg-type]

    def test_positive_differences(self, executor: ToolExecutor) -> None:
        """Test interpretation of positive differences."""
        differences = {"fiber_g": 25.0, "protein_g": 15.0}

        result = executor._interpret_comparison(differences)

        assert "fiber" in result.lower()
        assert "25" in result
        assert "more" in result

    def test_negative_differences(self, executor: ToolExecutor) -> None:
        """Test interpretation of negative differences."""
        differences = {"sugar_g": -30.0}

        result = executor._interpret_comparison(differences)

        assert "sugar" in result.lower()
        assert "30" in result
        assert "less" in result

    def test_negligible_differences_ignored(self, executor: ToolExecutor) -> None:
        """Test that differences < 5% are ignored."""
        differences = {"calories": 2.0, "protein_g": -3.0}

        result = executor._interpret_comparison(differences)

        assert "No significant differences" in result

    def test_empty_differences(self, executor: ToolExecutor) -> None:
        """Test interpretation of empty differences dict."""
        result = executor._interpret_comparison({})

        assert "No significant differences" in result

    def test_max_insights_limited(self, executor: ToolExecutor) -> None:
        """Test that insights are limited to 5."""
        differences = {
            "calories": 50.0,
            "protein_g": 40.0,
            "carbs_g": 30.0,
            "fat_g": 20.0,
            "fiber_g": 15.0,
            "sugar_g": 10.0,
            "sodium_mg": 8.0,
        }

        result = executor._interpret_comparison(differences)

        # Count the separator to determine number of insights
        # Format is "insight1 | insight2 | ..."
        separators = result.count(" | ")
        assert separators <= 4  # At most 5 insights (4 separators)


class TestToolExecutorInit:
    """Tests for ToolExecutor initialization."""

    def test_initialization(self) -> None:
        """Test that ToolExecutor initializes correctly."""
        user_id = uuid4()
        executor = ToolExecutor(None, user_id)  # type: ignore[arg-type]

        assert executor.user_id == user_id
        assert executor.db is None
        assert executor.logger is not None

    def test_different_users_have_different_executors(self) -> None:
        """Test that different users create separate executors."""
        user1 = uuid4()
        user2 = uuid4()

        executor1 = ToolExecutor(None, user1)  # type: ignore[arg-type]
        executor2 = ToolExecutor(None, user2)  # type: ignore[arg-type]

        assert executor1.user_id != executor2.user_id


class TestToolExecutionError:
    """Tests for ToolExecutionError exception."""

    def test_exception_can_be_raised(self) -> None:
        """Test that ToolExecutionError can be raised and caught."""
        with pytest.raises(ToolExecutionError) as exc_info:
            raise ToolExecutionError("Test error message")

        assert str(exc_info.value) == "Test error message"

    def test_exception_is_subclass_of_exception(self) -> None:
        """Test that ToolExecutionError is a proper Exception subclass."""
        assert issubclass(ToolExecutionError, Exception)
