"""Unit tests for InsightsService correlation analysis."""

from datetime import datetime, timedelta

import pytest

from src.services.insights_service import (
    ConsistentCorrelation,
    CorrelationResult,
    InsightsService,
    TimeLagWindow,
)


class TestAnalyzeNutrientCorrelations:
    """Tests for _analyze_nutrient_correlations method."""

    @pytest.fixture
    def insights_service(self) -> InsightsService:
        """Create an insights service instance with None db."""
        return InsightsService(None)  # type: ignore[arg-type]

    def test_positive_correlation(self, insights_service: InsightsService) -> None:
        """Test detection of positive correlation (more fiber = higher Bristol)."""
        now = datetime.now()

        # Create BM data with Bristol scores
        bm_data = [
            (3, now - timedelta(hours=1)),  # Low Bristol
            (3, now - timedelta(hours=25)),  # Low Bristol
            (5, now - timedelta(hours=49)),  # Medium Bristol
            (6, now - timedelta(hours=73)),  # High Bristol
            (7, now - timedelta(hours=97)),  # High Bristol
        ]

        # Create food data where high fiber correlates with high Bristol
        food_data = [
            {"logged_at": now - timedelta(hours=25), "raw_data": {"fiber_g": 5}},
            {"logged_at": now - timedelta(hours=49), "raw_data": {"fiber_g": 10}},
            {"logged_at": now - timedelta(hours=73), "raw_data": {"fiber_g": 20}},
            {"logged_at": now - timedelta(hours=97), "raw_data": {"fiber_g": 30}},
            {"logged_at": now - timedelta(hours=121), "raw_data": {"fiber_g": 40}},
        ]

        results = insights_service._analyze_nutrient_correlations(
            bm_data=bm_data,
            food_data=food_data,
            time_lag=TimeLagWindow.HOURS_24,
            nutrients_to_analyze=["fiber_g"],
        )

        assert len(results) == 1
        result = results[0]
        assert result.nutrient_key == "fiber_g"
        assert result.correlation_coefficient > 0  # Positive correlation
        assert result.direction == "positive"

    def test_negative_correlation(self, insights_service: InsightsService) -> None:
        """Test detection of negative correlation (more protein = lower Bristol)."""
        now = datetime.now()

        # Create BM data: low protein = high Bristol, high protein = low Bristol
        bm_data = [
            (7, now - timedelta(hours=1)),  # High Bristol
            (6, now - timedelta(hours=25)),  # High Bristol
            (4, now - timedelta(hours=49)),  # Medium Bristol
            (3, now - timedelta(hours=73)),  # Low Bristol
            (2, now - timedelta(hours=97)),  # Low Bristol
        ]

        # Create food data where high protein correlates with low Bristol
        food_data = [
            {"logged_at": now - timedelta(hours=25), "raw_data": {"protein_g": 10}},
            {"logged_at": now - timedelta(hours=49), "raw_data": {"protein_g": 30}},
            {"logged_at": now - timedelta(hours=73), "raw_data": {"protein_g": 50}},
            {"logged_at": now - timedelta(hours=97), "raw_data": {"protein_g": 80}},
            {"logged_at": now - timedelta(hours=121), "raw_data": {"protein_g": 100}},
        ]

        results = insights_service._analyze_nutrient_correlations(
            bm_data=bm_data,
            food_data=food_data,
            time_lag=TimeLagWindow.HOURS_24,
            nutrients_to_analyze=["protein_g"],
        )

        assert len(results) == 1
        result = results[0]
        assert result.nutrient_key == "protein_g"
        assert result.correlation_coefficient < 0  # Negative correlation
        assert result.direction == "negative"

    def test_no_correlation(self, insights_service: InsightsService) -> None:
        """Test detection of no significant correlation (high p-value)."""
        now = datetime.now()

        # Random data with no clear pattern
        bm_data = [
            (4, now - timedelta(hours=1)),
            (5, now - timedelta(hours=25)),
            (3, now - timedelta(hours=49)),
            (6, now - timedelta(hours=73)),
            (4, now - timedelta(hours=97)),
        ]

        # Random nutrient values that don't correlate with Bristol
        food_data = [
            {"logged_at": now - timedelta(hours=25), "raw_data": {"sodium_mg": 100}},
            {"logged_at": now - timedelta(hours=49), "raw_data": {"sodium_mg": 500}},
            {"logged_at": now - timedelta(hours=73), "raw_data": {"sodium_mg": 200}},
            {"logged_at": now - timedelta(hours=97), "raw_data": {"sodium_mg": 800}},
            {"logged_at": now - timedelta(hours=121), "raw_data": {"sodium_mg": 300}},
        ]

        results = insights_service._analyze_nutrient_correlations(
            bm_data=bm_data,
            food_data=food_data,
            time_lag=TimeLagWindow.HOURS_24,
            nutrients_to_analyze=["sodium_mg"],
        )

        # Results may or may not be returned depending on variance
        if results:
            # If returned, correlation should be weak
            assert abs(results[0].correlation_coefficient) < 0.5

    def test_high_low_intake_comparison(self, insights_service: InsightsService) -> None:
        """Test that high/low intake averages are calculated correctly."""
        now = datetime.now()

        # Create clear high/low pattern
        bm_data = [
            (2, now - timedelta(hours=1)),
            (3, now - timedelta(hours=25)),
            (6, now - timedelta(hours=49)),
            (7, now - timedelta(hours=73)),
        ]

        food_data = [
            {"logged_at": now - timedelta(hours=25), "raw_data": {"fat_g": 10}},
            {"logged_at": now - timedelta(hours=49), "raw_data": {"fat_g": 20}},
            {"logged_at": now - timedelta(hours=73), "raw_data": {"fat_g": 50}},
            {"logged_at": now - timedelta(hours=97), "raw_data": {"fat_g": 60}},
        ]

        results = insights_service._analyze_nutrient_correlations(
            bm_data=bm_data,
            food_data=food_data,
            time_lag=TimeLagWindow.HOURS_24,
            nutrients_to_analyze=["fat_g"],
        )

        assert len(results) == 1
        result = results[0]

        # High intake should be associated with different Bristol than low intake
        assert result.avg_bristol_high_intake is not None
        assert result.avg_bristol_low_intake is not None
        assert result.intake_high_threshold is not None
        assert result.intake_low_threshold is not None

    def test_insufficient_data(self, insights_service: InsightsService) -> None:
        """Test that insufficient data returns empty results."""
        now = datetime.now()

        # Only 2 data points - not enough for correlation
        bm_data = [
            (4, now - timedelta(hours=1)),
            (5, now - timedelta(hours=25)),
        ]

        food_data = [
            {"logged_at": now - timedelta(hours=25), "raw_data": {"fiber_g": 10}},
            {"logged_at": now - timedelta(hours=49), "raw_data": {"fiber_g": 20}},
        ]

        results = insights_service._analyze_nutrient_correlations(
            bm_data=bm_data,
            food_data=food_data,
            time_lag=TimeLagWindow.HOURS_24,
            nutrients_to_analyze=["fiber_g"],
        )

        # Should return empty list due to insufficient data points
        assert len(results) == 0

    def test_multiple_nutrients(self, insights_service: InsightsService) -> None:
        """Test analysis of multiple nutrients simultaneously."""
        now = datetime.now()

        bm_data = [
            (3, now - timedelta(hours=1)),
            (4, now - timedelta(hours=25)),
            (5, now - timedelta(hours=49)),
            (6, now - timedelta(hours=73)),
            (7, now - timedelta(hours=97)),
        ]

        food_data = [
            {
                "logged_at": now - timedelta(hours=25),
                "raw_data": {"fiber_g": 10, "protein_g": 100},
            },
            {
                "logged_at": now - timedelta(hours=49),
                "raw_data": {"fiber_g": 15, "protein_g": 80},
            },
            {
                "logged_at": now - timedelta(hours=73),
                "raw_data": {"fiber_g": 20, "protein_g": 60},
            },
            {
                "logged_at": now - timedelta(hours=97),
                "raw_data": {"fiber_g": 25, "protein_g": 40},
            },
            {
                "logged_at": now - timedelta(hours=121),
                "raw_data": {"fiber_g": 30, "protein_g": 20},
            },
        ]

        results = insights_service._analyze_nutrient_correlations(
            bm_data=bm_data,
            food_data=food_data,
            time_lag=TimeLagWindow.HOURS_24,
            nutrients_to_analyze=["fiber_g", "protein_g"],
        )

        # Should have results for both nutrients
        assert len(results) == 2
        nutrient_keys = {r.nutrient_key for r in results}
        assert "fiber_g" in nutrient_keys
        assert "protein_g" in nutrient_keys


class TestFindConsistentCorrelations:
    """Tests for _find_consistent_correlations method."""

    @pytest.fixture
    def insights_service(self) -> InsightsService:
        """Create an insights service instance with None db."""
        return InsightsService(None)  # type: ignore[arg-type]

    def test_consistent_across_windows(self, insights_service: InsightsService) -> None:
        """Test finding nutrients significant across multiple windows."""
        results_by_lag = {
            12: [
                CorrelationResult(
                    nutrient_name="Fiber",
                    nutrient_key="fiber_g",
                    time_lag_hours=12,
                    correlation_coefficient=0.7,
                    p_value=0.01,
                    sample_size=20,
                    is_significant=True,
                    avg_bristol_high_intake=5.5,
                    avg_bristol_low_intake=3.5,
                    intake_high_threshold=25.0,
                    intake_low_threshold=10.0,
                    direction="positive",
                ),
            ],
            24: [
                CorrelationResult(
                    nutrient_name="Fiber",
                    nutrient_key="fiber_g",
                    time_lag_hours=24,
                    correlation_coefficient=0.65,
                    p_value=0.02,
                    sample_size=20,
                    is_significant=True,
                    avg_bristol_high_intake=5.3,
                    avg_bristol_low_intake=3.7,
                    intake_high_threshold=24.0,
                    intake_low_threshold=11.0,
                    direction="positive",
                ),
            ],
            36: [
                CorrelationResult(
                    nutrient_name="Fiber",
                    nutrient_key="fiber_g",
                    time_lag_hours=36,
                    correlation_coefficient=0.6,
                    p_value=0.03,
                    sample_size=20,
                    is_significant=True,
                    avg_bristol_high_intake=5.2,
                    avg_bristol_low_intake=3.8,
                    intake_high_threshold=23.0,
                    intake_low_threshold=12.0,
                    direction="positive",
                ),
            ],
        }

        consistent = insights_service._find_consistent_correlations(results_by_lag)

        assert len(consistent) == 1
        assert consistent[0].nutrient_key == "fiber_g"
        assert consistent[0].windows_significant == 3
        assert consistent[0].direction == "positive"

    def test_not_consistent(self, insights_service: InsightsService) -> None:
        """Test that nutrients significant in only 1 window are excluded."""
        results_by_lag = {
            12: [
                CorrelationResult(
                    nutrient_name="Sodium",
                    nutrient_key="sodium_mg",
                    time_lag_hours=12,
                    correlation_coefficient=0.5,
                    p_value=0.04,
                    sample_size=20,
                    is_significant=True,
                    avg_bristol_high_intake=5.0,
                    avg_bristol_low_intake=4.0,
                    intake_high_threshold=2000.0,
                    intake_low_threshold=1000.0,
                    direction="positive",
                ),
            ],
            24: [
                CorrelationResult(
                    nutrient_name="Sodium",
                    nutrient_key="sodium_mg",
                    time_lag_hours=24,
                    correlation_coefficient=0.2,
                    p_value=0.3,
                    sample_size=20,
                    is_significant=False,  # Not significant in this window
                    avg_bristol_high_intake=4.8,
                    avg_bristol_low_intake=4.2,
                    intake_high_threshold=2100.0,
                    intake_low_threshold=900.0,
                    direction="none",
                ),
            ],
        }

        consistent = insights_service._find_consistent_correlations(results_by_lag)

        # Should be empty since only significant in 1 window
        assert len(consistent) == 0

    def test_mixed_direction(self, insights_service: InsightsService) -> None:
        """Test detection of mixed correlation direction."""
        results_by_lag = {
            12: [
                CorrelationResult(
                    nutrient_name="Caffeine",
                    nutrient_key="caffeine_mg",
                    time_lag_hours=12,
                    correlation_coefficient=0.6,
                    p_value=0.02,
                    sample_size=20,
                    is_significant=True,
                    avg_bristol_high_intake=5.5,
                    avg_bristol_low_intake=4.0,
                    intake_high_threshold=200.0,
                    intake_low_threshold=50.0,
                    direction="positive",
                ),
            ],
            24: [
                CorrelationResult(
                    nutrient_name="Caffeine",
                    nutrient_key="caffeine_mg",
                    time_lag_hours=24,
                    correlation_coefficient=-0.5,
                    p_value=0.03,
                    sample_size=20,
                    is_significant=True,
                    avg_bristol_high_intake=3.5,
                    avg_bristol_low_intake=5.0,
                    intake_high_threshold=180.0,
                    intake_low_threshold=60.0,
                    direction="negative",
                ),
            ],
        }

        consistent = insights_service._find_consistent_correlations(results_by_lag)

        assert len(consistent) == 1
        assert consistent[0].nutrient_key == "caffeine_mg"
        assert consistent[0].direction == "mixed"


class TestGenerateInsights:
    """Tests for _generate_insights method."""

    @pytest.fixture
    def insights_service(self) -> InsightsService:
        """Create an insights service instance with None db."""
        return InsightsService(None)  # type: ignore[arg-type]

    def test_baseline_too_hard(self, insights_service: InsightsService) -> None:
        """Test insight for low baseline Bristol (constipation)."""
        insights = insights_service._generate_insights(
            baseline_bristol=2.0,
            consistent_correlations=[],
            results_by_lag={},
        )

        assert len(insights) >= 1
        assert "too hard" in insights[0].lower() or "constipation" in insights[0].lower()

    def test_baseline_too_loose(self, insights_service: InsightsService) -> None:
        """Test insight for high baseline Bristol (diarrhea)."""
        insights = insights_service._generate_insights(
            baseline_bristol=6.5,
            consistent_correlations=[],
            results_by_lag={},
        )

        assert len(insights) >= 1
        assert "loose" in insights[0].lower() or "diarrhea" in insights[0].lower()

    def test_baseline_healthy(self, insights_service: InsightsService) -> None:
        """Test insight for healthy baseline Bristol."""
        insights = insights_service._generate_insights(
            baseline_bristol=4.0,
            consistent_correlations=[],
            results_by_lag={},
        )

        assert len(insights) >= 1
        assert "healthy" in insights[0].lower() or "good" in insights[0].lower()

    def test_correlation_insights(self, insights_service: InsightsService) -> None:
        """Test that correlation insights are generated."""
        consistent = [
            ConsistentCorrelation(
                nutrient_name="Fiber",
                nutrient_key="fiber_g",
                windows_significant=3,
                avg_correlation=0.65,
                direction="positive",
            ),
        ]

        insights = insights_service._generate_insights(
            baseline_bristol=4.0,
            consistent_correlations=consistent,
            results_by_lag={},
        )

        # Should have baseline insight + correlation insight
        assert len(insights) >= 2
        # Check fiber is mentioned in one of the insights
        fiber_insight = [i for i in insights if "fiber" in i.lower()]
        assert len(fiber_insight) >= 1

    def test_no_correlations_fallback(self, insights_service: InsightsService) -> None:
        """Test fallback message when no consistent correlations."""
        insights = insights_service._generate_insights(
            baseline_bristol=4.0,
            consistent_correlations=[],
            results_by_lag={},
        )

        assert len(insights) >= 2  # Baseline + no correlations message
        no_pattern_insight = [i for i in insights if "no nutrient" in i.lower()]
        assert len(no_pattern_insight) >= 1
