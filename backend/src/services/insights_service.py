"""Insights service for analyzing correlations between nutrition and bowel movements."""

from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


class TimeLagWindow(Enum):
    """Time windows for analyzing correlation between food intake and BM outcomes."""

    HOURS_12 = 12
    HOURS_24 = 24
    HOURS_36 = 36
    HOURS_48 = 48
    HOURS_72 = 72


@dataclass
class CorrelationResult:
    """Result of correlation analysis for a single nutrient."""

    nutrient_name: str
    nutrient_key: str
    time_lag_hours: int
    correlation_coefficient: float
    p_value: float
    sample_size: int
    is_significant: bool
    avg_bristol_high_intake: float | None
    avg_bristol_low_intake: float | None
    intake_high_threshold: float | None
    intake_low_threshold: float | None
    direction: str  # "positive", "negative", or "none"


@dataclass
class ConsistentCorrelation:
    """A nutrient that shows significant correlation across multiple time windows."""

    nutrient_name: str
    nutrient_key: str
    windows_significant: int
    avg_correlation: float
    direction: str


@dataclass
class MultiLagCorrelationResponse:
    """Complete response for multi-lag correlation analysis."""

    baseline_bristol_score: float
    total_bowel_movements: int
    total_food_logs: int
    analysis_start_date: date
    analysis_end_date: date
    results_by_lag: dict[int, list[CorrelationResult]] = field(default_factory=dict)
    consistent_correlations: list[ConsistentCorrelation] = field(default_factory=list)
    insights: list[str] = field(default_factory=list)


class InsufficientDataError(Exception):
    """Raised when there isn't enough data for meaningful correlation analysis."""

    pass


# Comprehensive list of nutrients tracked by Cronometer
# Maps Cronometer column names to human-readable names
TRACKED_NUTRIENTS: dict[str, str] = {
    # Macronutrients
    "calories": "Calories",
    "protein_g": "Protein",
    "carbs_g": "Carbohydrates",
    "fat_g": "Total Fat",
    "fiber_g": "Fiber",
    "sugar_g": "Sugar",
    "saturated_fat_g": "Saturated Fat",
    "monounsaturated_fat_g": "Monounsaturated Fat",
    "polyunsaturated_fat_g": "Polyunsaturated Fat",
    "trans_fat_g": "Trans Fat",
    "cholesterol_mg": "Cholesterol",
    "net_carbs_g": "Net Carbs",
    "starch_g": "Starch",
    # Minerals
    "sodium_mg": "Sodium",
    "potassium_mg": "Potassium",
    "calcium_mg": "Calcium",
    "magnesium_mg": "Magnesium",
    "iron_mg": "Iron",
    "zinc_mg": "Zinc",
    "copper_mg": "Copper",
    "manganese_mg": "Manganese",
    "selenium_mcg": "Selenium",
    "phosphorus_mg": "Phosphorus",
    "chromium_mcg": "Chromium",
    "molybdenum_mcg": "Molybdenum",
    "iodine_mcg": "Iodine",
    "fluoride_mcg": "Fluoride",
    "chloride_mg": "Chloride",
    # Fat-Soluble Vitamins
    "vitamin_a_iu": "Vitamin A (IU)",
    "vitamin_a_rae_mcg": "Vitamin A (RAE)",
    "retinol_mcg": "Retinol",
    "beta_carotene_mcg": "Beta-Carotene",
    "alpha_carotene_mcg": "Alpha-Carotene",
    "lycopene_mcg": "Lycopene",
    "lutein_zeaxanthin_mcg": "Lutein + Zeaxanthin",
    "vitamin_d_iu": "Vitamin D (IU)",
    "vitamin_d_mcg": "Vitamin D (mcg)",
    "vitamin_e_mg": "Vitamin E",
    "alpha_tocopherol_mg": "Alpha-Tocopherol",
    "vitamin_k_mcg": "Vitamin K",
    # Water-Soluble Vitamins
    "vitamin_c_mg": "Vitamin C",
    "thiamin_mg": "Thiamin (B1)",
    "riboflavin_mg": "Riboflavin (B2)",
    "niacin_mg": "Niacin (B3)",
    "pantothenic_acid_mg": "Pantothenic Acid (B5)",
    "vitamin_b6_mg": "Vitamin B6",
    "biotin_mcg": "Biotin (B7)",
    "folate_mcg": "Folate (B9)",
    "folic_acid_mcg": "Folic Acid",
    "food_folate_mcg": "Food Folate",
    "folate_dfe_mcg": "Folate (DFE)",
    "vitamin_b12_mcg": "Vitamin B12",
    "choline_mg": "Choline",
    # Amino Acids
    "tryptophan_mg": "Tryptophan",
    "threonine_mg": "Threonine",
    "isoleucine_mg": "Isoleucine",
    "leucine_mg": "Leucine",
    "lysine_mg": "Lysine",
    "methionine_mg": "Methionine",
    "cystine_mg": "Cystine",
    "phenylalanine_mg": "Phenylalanine",
    "tyrosine_mg": "Tyrosine",
    "valine_mg": "Valine",
    "arginine_mg": "Arginine",
    "histidine_mg": "Histidine",
    "alanine_mg": "Alanine",
    "aspartic_acid_mg": "Aspartic Acid",
    "glutamic_acid_mg": "Glutamic Acid",
    "glycine_mg": "Glycine",
    "proline_mg": "Proline",
    "serine_mg": "Serine",
    # Fatty Acids
    "omega_3_g": "Omega-3",
    "omega_6_g": "Omega-6",
    "epa_mg": "EPA",
    "dha_mg": "DHA",
    "ala_mg": "ALA",
    # Other
    "caffeine_mg": "Caffeine",
    "alcohol_g": "Alcohol",
    "water_g": "Water",
    "ash_g": "Ash",
}

# Group nutrients by category for organized display
NUTRIENT_GROUPS: dict[str, list[str]] = {
    "Macronutrients": [
        "calories",
        "protein_g",
        "carbs_g",
        "fat_g",
        "fiber_g",
        "sugar_g",
        "saturated_fat_g",
        "monounsaturated_fat_g",
        "polyunsaturated_fat_g",
        "trans_fat_g",
        "cholesterol_mg",
        "net_carbs_g",
        "starch_g",
    ],
    "Minerals": [
        "sodium_mg",
        "potassium_mg",
        "calcium_mg",
        "magnesium_mg",
        "iron_mg",
        "zinc_mg",
        "copper_mg",
        "manganese_mg",
        "selenium_mcg",
        "phosphorus_mg",
        "chromium_mcg",
        "molybdenum_mcg",
        "iodine_mcg",
        "fluoride_mcg",
        "chloride_mg",
    ],
    "Fat-Soluble Vitamins": [
        "vitamin_a_iu",
        "vitamin_a_rae_mcg",
        "retinol_mcg",
        "beta_carotene_mcg",
        "alpha_carotene_mcg",
        "lycopene_mcg",
        "lutein_zeaxanthin_mcg",
        "vitamin_d_iu",
        "vitamin_d_mcg",
        "vitamin_e_mg",
        "alpha_tocopherol_mg",
        "vitamin_k_mcg",
    ],
    "Water-Soluble Vitamins": [
        "vitamin_c_mg",
        "thiamin_mg",
        "riboflavin_mg",
        "niacin_mg",
        "pantothenic_acid_mg",
        "vitamin_b6_mg",
        "biotin_mcg",
        "folate_mcg",
        "folic_acid_mcg",
        "food_folate_mcg",
        "folate_dfe_mcg",
        "vitamin_b12_mcg",
        "choline_mg",
    ],
    "Amino Acids": [
        "tryptophan_mg",
        "threonine_mg",
        "isoleucine_mg",
        "leucine_mg",
        "lysine_mg",
        "methionine_mg",
        "cystine_mg",
        "phenylalanine_mg",
        "tyrosine_mg",
        "valine_mg",
        "arginine_mg",
        "histidine_mg",
        "alanine_mg",
        "aspartic_acid_mg",
        "glutamic_acid_mg",
        "glycine_mg",
        "proline_mg",
        "serine_mg",
    ],
    "Fatty Acids": [
        "omega_3_g",
        "omega_6_g",
        "epa_mg",
        "dha_mg",
        "ala_mg",
    ],
    "Other": [
        "caffeine_mg",
        "alcohol_g",
        "water_g",
        "ash_g",
    ],
}


class InsightsService:
    """Service for analyzing correlations between nutrition and bowel movements."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the insights service.

        Args:
            db: The async database session.
        """
        self.db = db
        self.logger = logger.bind(service="insights")

    async def analyze_correlations(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
        time_lags: list[TimeLagWindow] | None = None,
        min_sample_size: int = 5,
        analysis_level: str = "standard",
    ) -> MultiLagCorrelationResponse:
        """Analyze correlations between nutrient intake and bowel movement outcomes.

        Args:
            user_id: The user's UUID.
            start_date: Start date for analysis (inclusive).
            end_date: End date for analysis (inclusive).
            time_lags: List of time windows to analyze. Defaults to all windows.
            min_sample_size: Minimum number of BM samples required.
            analysis_level: "basic" (macros only), "standard", or "comprehensive".

        Returns:
            MultiLagCorrelationResponse with all correlation data.

        Raises:
            InsufficientDataError: If not enough BM data for analysis.
        """
        if time_lags is None:
            time_lags = list(TimeLagWindow)

        self.logger.info(
            "starting_correlation_analysis",
            user_id=str(user_id),
            start_date=str(start_date),
            end_date=str(end_date),
            time_lags=[t.value for t in time_lags],
            min_sample_size=min_sample_size,
            analysis_level=analysis_level,
        )

        # Placeholder implementation - will be completed in US-020
        # For now, return an empty response structure
        return MultiLagCorrelationResponse(
            baseline_bristol_score=0.0,
            total_bowel_movements=0,
            total_food_logs=0,
            analysis_start_date=start_date,
            analysis_end_date=end_date,
            results_by_lag={},
            consistent_correlations=[],
            insights=[],
        )

    def _get_nutrient_value(self, raw_data: dict, nutrient_key: str) -> float | None:
        """Extract a nutrient value from food log raw_data.

        Args:
            raw_data: The raw_data JSON from a FoodLog.
            nutrient_key: The key to look up (e.g., "fiber_g").

        Returns:
            The nutrient value, or None if not present.
        """
        if not raw_data:
            return None
        value = raw_data.get(nutrient_key)
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    async def _analyze_nutrient_correlations(
        self,
        bm_data: list[tuple[float, float]],  # (bristol_score, timestamp)
        food_data: list[dict],
        time_lag: TimeLagWindow,
        nutrients_to_analyze: list[str],
    ) -> list[CorrelationResult]:
        """Analyze correlations for a specific time lag window.

        Args:
            bm_data: List of (bristol_score, timestamp) tuples.
            food_data: List of food log dictionaries with raw_data.
            time_lag: The time window to analyze.
            nutrients_to_analyze: List of nutrient keys to analyze.

        Returns:
            List of CorrelationResult objects for each nutrient.
        """
        # Placeholder - will be implemented in US-018
        return []

    def _find_consistent_correlations(
        self,
        results_by_lag: dict[int, list[CorrelationResult]],
        min_windows: int = 2,
    ) -> list[ConsistentCorrelation]:
        """Find nutrients with significant correlations across multiple time windows.

        Args:
            results_by_lag: Correlation results keyed by time lag hours.
            min_windows: Minimum number of windows for "consistent" status.

        Returns:
            List of ConsistentCorrelation objects.
        """
        # Placeholder - will be implemented in US-019
        return []

    def _generate_insights(
        self,
        baseline_bristol: float,
        consistent_correlations: list[ConsistentCorrelation],
        results_by_lag: dict[int, list[CorrelationResult]],
    ) -> list[str]:
        """Generate human-readable insights from correlation analysis.

        Args:
            baseline_bristol: Average Bristol score.
            consistent_correlations: Nutrients with consistent correlations.
            results_by_lag: All correlation results by time lag.

        Returns:
            List of insight strings.
        """
        # Placeholder - will be implemented in US-019
        return []
