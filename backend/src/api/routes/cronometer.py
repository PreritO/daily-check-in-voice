"""Cronometer integration API endpoints."""

from datetime import UTC, date, datetime, timedelta
from typing import Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pycronometer.exceptions import CronometerAuthError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_or_create_user
from src.api.schemas import (
    BristolEvent,
    ComparisonResultSchema,
    CredentialStatusResponse,
    DailyTimelineData,
    ExerciseLogResponse,
    FoodAnalysisResponseSchema,
    FoodCorrelationResultSchema,
    FoodLogResponse,
    GrangerResponse,
    GrangerResultSchema,
    HealthNoteResponse,
    MultiLagCorrelationResponseSchema,
    OptimalRangeSchema,
    OptimalRangesResponseSchema,
    SaveCredentialsRequest,
    SyncRequest,
    SyncResponse,
    TimelineResponse,
)
from src.database import get_db
from src.integrations.cronometer import CronometerSyncService
from src.models import CronometerCredential, ExerciseLog, FoodLog, HealthNote, User
from src.services import (
    ControlledComparisonService,
    FoodCorrelationService,
    FoodInsufficientDataError,
    GrangerCausalityService,
    GrangerInsufficientDataError,
    InsufficientMatchesError,
    OptimalRangesService,
)
from src.services.insights_service import (
    InsightsService,
    InsufficientDataError,
    TimeLagWindow,
)
from src.services.optimal_ranges_service import (
    InsufficientDataError as OptimalRangesInsufficientDataError,
)
from src.utils.encryption import encrypt_string

logger = structlog.get_logger()

router = APIRouter()


@router.post("/credentials", status_code=status.HTTP_201_CREATED)
async def save_credentials(
    request: SaveCredentialsRequest,
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> CredentialStatusResponse:
    """Save encrypted Cronometer credentials for the current user.

    Args:
        request: Email and password to save.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        Credential status after saving.
    """
    # Check if credentials already exist
    result = await db.execute(
        select(CronometerCredential).where(CronometerCredential.user_id == current_user.id)
    )
    credential = result.scalar_one_or_none()

    # Encrypt credentials
    encrypted_email = encrypt_string(request.email)
    encrypted_password = encrypt_string(request.password)

    if credential:
        # Update existing credentials
        credential.encrypted_email = encrypted_email
        credential.encrypted_password = encrypted_password
        logger.info("Updated Cronometer credentials", user_id=str(current_user.id))
    else:
        # Create new credentials
        credential = CronometerCredential(
            user_id=current_user.id,
            encrypted_email=encrypted_email,
            encrypted_password=encrypted_password,
        )
        db.add(credential)
        logger.info("Saved Cronometer credentials", user_id=str(current_user.id))

    await db.flush()
    await db.refresh(credential)

    return CredentialStatusResponse(
        has_credentials=True,
        last_sync_at=credential.last_sync_at,
    )


@router.get("/credentials/status", response_model=CredentialStatusResponse)
async def get_credential_status(
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> CredentialStatusResponse:
    """Check if Cronometer credentials exist for the current user.

    Args:
        current_user: The authenticated user.
        db: Database session.

    Returns:
        Credential status with last sync time.
    """
    result = await db.execute(
        select(CronometerCredential).where(CronometerCredential.user_id == current_user.id)
    )
    credential = result.scalar_one_or_none()

    return CredentialStatusResponse(
        has_credentials=credential is not None,
        last_sync_at=credential.last_sync_at if credential else None,
    )


@router.delete("/credentials", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credentials(
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete Cronometer credentials for the current user.

    Args:
        current_user: The authenticated user.
        db: Database session.

    Raises:
        HTTPException: 404 if no credentials exist.
    """
    result = await db.execute(
        select(CronometerCredential).where(CronometerCredential.user_id == current_user.id)
    )
    credential = result.scalar_one_or_none()

    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Cronometer credentials found",
        )

    await db.delete(credential)
    await db.flush()
    logger.info("Deleted Cronometer credentials", user_id=str(current_user.id))


@router.post("/sync", response_model=SyncResponse)
async def sync_cronometer_data(
    request: SyncRequest = SyncRequest(),
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> SyncResponse:
    """Trigger a manual Cronometer sync for the current user.

    Args:
        request: Sync parameters (days_back, default 7, max 90).
        current_user: The authenticated user.
        db: Database session.

    Returns:
        Sync result with counts and timestamp.

    Raises:
        HTTPException: 404 if no credentials saved, 401 if Cronometer login fails.
    """
    # Check if credentials exist
    result = await db.execute(
        select(CronometerCredential).where(CronometerCredential.user_id == current_user.id)
    )
    credential = result.scalar_one_or_none()

    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Cronometer credentials found. Please save credentials first.",
        )

    # Run sync
    sync_service = CronometerSyncService(db)
    try:
        sync_result = await sync_service.sync_user(current_user.id, request.days_back)
    except CronometerAuthError as e:
        logger.warning(
            "Cronometer login failed",
            user_id=str(current_user.id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cronometer login failed. Please check your credentials.",
        ) from e

    logger.info(
        "Cronometer sync completed",
        user_id=str(current_user.id),
        food_logs=sync_result.food_logs_synced,
        biometric_logs=sync_result.biometric_logs_synced,
        health_notes=sync_result.health_notes_synced,
        exercises=sync_result.exercises_synced,
    )

    return SyncResponse(
        food_logs_synced=sync_result.food_logs_synced,
        biometric_logs_synced=sync_result.biometric_logs_synced,
        health_notes_synced=sync_result.health_notes_synced,
        exercises_synced=sync_result.exercises_synced,
        synced_at=datetime.now(UTC),
    )


@router.get("/food-logs", response_model=list[FoodLogResponse])
async def get_food_logs(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> list[FoodLog]:
    """Get food logs for the current user within a date range.

    Args:
        start_date: Start date (inclusive).
        end_date: End date (inclusive).
        current_user: The authenticated user.
        db: Database session.

    Returns:
        List of food logs, ordered by logged_at descending.
    """
    # Convert dates to datetimes for comparison
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    result = await db.execute(
        select(FoodLog)
        .where(FoodLog.user_id == current_user.id)
        .where(FoodLog.logged_at >= start_dt)
        .where(FoodLog.logged_at <= end_dt)
        .order_by(FoodLog.logged_at.desc())
    )
    return list(result.scalars().all())


@router.get("/health-notes", response_model=list[HealthNoteResponse])
async def get_health_notes(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> list[HealthNote]:
    """Get health notes for the current user within a date range.

    Args:
        start_date: Start date (inclusive).
        end_date: End date (inclusive).
        current_user: The authenticated user.
        db: Database session.

    Returns:
        List of health notes, ordered by logged_at descending.
    """
    # Convert dates to datetimes for comparison
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    result = await db.execute(
        select(HealthNote)
        .where(HealthNote.user_id == current_user.id)
        .where(HealthNote.logged_at >= start_dt)
        .where(HealthNote.logged_at <= end_dt)
        .order_by(HealthNote.logged_at.desc())
    )
    return list(result.scalars().all())


@router.get("/exercises", response_model=list[ExerciseLogResponse])
async def get_exercises(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> list[ExerciseLog]:
    """Get exercise logs for the current user within a date range.

    Args:
        start_date: Start date (inclusive).
        end_date: End date (inclusive).
        current_user: The authenticated user.
        db: Database session.

    Returns:
        List of exercise logs, ordered by logged_at descending.
    """
    # Convert dates to datetimes for comparison
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    result = await db.execute(
        select(ExerciseLog)
        .where(ExerciseLog.user_id == current_user.id)
        .where(ExerciseLog.logged_at >= start_dt)
        .where(ExerciseLog.logged_at <= end_dt)
        .order_by(ExerciseLog.logged_at.desc())
    )
    return list(result.scalars().all())


# Valid time lag values for query parameter validation
VALID_TIME_LAGS = {12, 24, 36, 48, 72}


@router.get("/insights/correlations", response_model=MultiLagCorrelationResponseSchema)
async def get_correlations(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    time_lags: list[int] = Query(
        default=[12, 24, 36, 48, 72],
        description="Time lag windows in hours (valid: 12, 24, 36, 48, 72)",
    ),
    min_sample_size: int = Query(default=5, ge=3, le=100, description="Min BM samples required"),
    analysis_level: Literal["basic", "standard", "comprehensive"] = Query(
        default="standard", description="Level of nutrient analysis"
    ),
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> MultiLagCorrelationResponseSchema:
    """Analyze correlations between nutrient intake and bowel movement outcomes.

    Args:
        start_date: Start date for analysis (inclusive).
        end_date: End date for analysis (inclusive).
        time_lags: List of time lag windows in hours to analyze.
        min_sample_size: Minimum number of BM samples required.
        analysis_level: basic (macros), standard, or comprehensive (all nutrients).
        current_user: The authenticated user.
        db: Database session.

    Returns:
        Correlation analysis results with insights.

    Raises:
        HTTPException: 400 if invalid time_lags or insufficient data.
    """
    # Validate time_lags
    invalid_lags = [lag for lag in time_lags if lag not in VALID_TIME_LAGS]
    if invalid_lags:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid time_lags: {invalid_lags}. Valid values: {sorted(VALID_TIME_LAGS)}",
        )

    # Convert to TimeLagWindow enum values
    time_lag_enums = [TimeLagWindow(lag) for lag in time_lags]

    # Run correlation analysis
    insights_service = InsightsService(db)
    try:
        result = await insights_service.analyze_correlations(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            time_lags=time_lag_enums,
            min_sample_size=min_sample_size,
            analysis_level=analysis_level,
        )
    except InsufficientDataError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    logger.info(
        "Correlation analysis completed",
        user_id=str(current_user.id),
        total_bms=result.total_bowel_movements,
        total_food_logs=result.total_food_logs,
        consistent_correlations=len(result.consistent_correlations),
    )

    # Convert dataclass to Pydantic schema
    return MultiLagCorrelationResponseSchema(
        baseline_bristol_score=result.baseline_bristol_score,
        total_bowel_movements=result.total_bowel_movements,
        total_food_logs=result.total_food_logs,
        analysis_start_date=result.analysis_start_date,
        analysis_end_date=result.analysis_end_date,
        results_by_lag={
            lag: [
                {
                    "nutrient_name": r.nutrient_name,
                    "nutrient_key": r.nutrient_key,
                    "time_lag_hours": r.time_lag_hours,
                    "correlation_coefficient": r.correlation_coefficient,
                    "p_value": r.p_value,
                    "sample_size": r.sample_size,
                    "is_significant": r.is_significant,
                    "avg_bristol_high_intake": r.avg_bristol_high_intake,
                    "avg_bristol_low_intake": r.avg_bristol_low_intake,
                    "intake_high_threshold": r.intake_high_threshold,
                    "intake_low_threshold": r.intake_low_threshold,
                    "direction": r.direction,
                }
                for r in results
            ]
            for lag, results in result.results_by_lag.items()
        },
        consistent_correlations=[
            {
                "nutrient_name": c.nutrient_name,
                "nutrient_key": c.nutrient_key,
                "windows_significant": c.windows_significant,
                "avg_correlation": c.avg_correlation,
                "direction": c.direction,
            }
            for c in result.consistent_correlations
        ],
        insights=result.insights,
    )


@router.get("/insights/timeline", response_model=TimelineResponse)
async def get_timeline(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    nutrients: list[str] = Query(
        default=["calories", "protein_g", "carbs_g", "fat_g", "fiber_g"],
        description="List of nutrient keys to include (from raw_data or model fields)",
    ),
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> TimelineResponse:
    """Get nutrient intake and Bristol events over time for visualization.

    Args:
        start_date: Start date for the timeline (inclusive).
        end_date: End date for the timeline (inclusive).
        nutrients: List of nutrient keys to aggregate (can be model fields like
            'calories', 'protein_g' or raw_data keys like 'Energy (kcal)').
        current_user: The authenticated user.
        db: Database session.

    Returns:
        Timeline data with daily nutrient totals and Bristol events.
    """
    # Convert dates to datetimes for comparison (timezone-naive)
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # Fetch food logs for the date range
    food_result = await db.execute(
        select(FoodLog)
        .where(FoodLog.user_id == current_user.id)
        .where(FoodLog.logged_at >= start_dt)
        .where(FoodLog.logged_at <= end_dt)
        .order_by(FoodLog.logged_at.asc())
    )
    food_logs = list(food_result.scalars().all())

    # Fetch health notes that are bowel movements with bristol_scale
    health_result = await db.execute(
        select(HealthNote)
        .where(HealthNote.user_id == current_user.id)
        .where(HealthNote.is_bowel_movement.is_(True))
        .where(HealthNote.bristol_scale.isnot(None))
        .where(HealthNote.logged_at >= start_dt)
        .where(HealthNote.logged_at <= end_dt)
        .order_by(HealthNote.logged_at.asc())
    )
    health_notes = list(health_result.scalars().all())

    # Mapping from user-friendly nutrient keys to model fields
    # Include both shorthand (e.g., "fiber") and full names (e.g., "fiber_g")
    nutrient_field_map: dict[str, str] = {
        "calories": "calories",
        "protein": "protein_g",
        "protein_g": "protein_g",
        "carbs": "carbs_g",
        "carbs_g": "carbs_g",
        "fat": "fat_g",
        "fat_g": "fat_g",
        "fiber": "fiber_g",
        "fiber_g": "fiber_g",
        "sugar": "sugar_g",
        "sugar_g": "sugar_g",
        "sodium": "sodium_mg",
        "sodium_mg": "sodium_mg",
    }

    # Mapping from friendly keys to Cronometer raw_data keys
    # These are the keys that Cronometer uses in the raw_data JSON
    friendly_to_cronometer: dict[str, str] = {
        # Macronutrients
        "calories": "Energy (kcal)",
        "protein": "Protein (g)",
        "carbs": "Carbs (g)",
        "fat": "Fat (g)",
        "fiber": "Fiber (g)",
        "sugar": "Sugars (g)",
        "saturated_fat": "Saturated (g)",
        "monounsaturated_fat": "Monounsaturated (g)",
        "polyunsaturated_fat": "Polyunsaturated (g)",
        "trans_fat": "Trans-Fats (g)",
        "cholesterol": "Cholesterol (mg)",
        "net_carbs": "Net Carbs (g)",
        "starch": "Starch (g)",
        "added_sugar": "Added Sugars (g)",
        # Fatty Acids
        "omega_3": "Omega-3 (g)",
        "omega_6": "Omega-6 (g)",
        # Sugars breakdown
        "fructose": "Fructose (g)",
        "galactose": "Galactose (g)",
        "glucose": "Glucose (g)",
        "lactose": "Lactose (g)",
        "maltose": "Maltose (g)",
        "sucrose": "Sucrose (g)",
        # Minerals
        "sodium": "Sodium (mg)",
        "potassium": "Potassium (mg)",
        "calcium": "Calcium (mg)",
        "magnesium": "Magnesium (mg)",
        "iron": "Iron (mg)",
        "zinc": "Zinc (mg)",
        "copper": "Copper (mg)",
        "manganese": "Manganese (mg)",
        "selenium": "Selenium (µg)",
        "phosphorus": "Phosphorus (mg)",
        # Fat-Soluble Vitamins
        "vitamin_a": "Vitamin A (µg)",
        "vitamin_d": "Vitamin D (IU)",
        "vitamin_e": "Vitamin E (mg)",
        "vitamin_k": "Vitamin K (µg)",
        # Water-Soluble Vitamins
        "vitamin_c": "Vitamin C (mg)",
        "vitamin_b1": "B1 (Thiamine) (mg)",
        "vitamin_b2": "B2 (Riboflavin) (mg)",
        "vitamin_b3": "B3 (Niacin) (mg)",
        "vitamin_b5": "B5 (Pantothenic Acid) (mg)",
        "vitamin_b6": "B6 (Pyridoxine) (mg)",
        "vitamin_b12": "B12 (Cobalamin) (µg)",
        "folate": "Folate (µg)",
        "vitamin_b9": "Folate (µg)",  # Alias for folate
        # Amino Acids
        "tryptophan": "Tryptophan (g)",
        "threonine": "Threonine (g)",
        "isoleucine": "Isoleucine (g)",
        "leucine": "Leucine (g)",
        "lysine": "Lysine (g)",
        "methionine": "Methionine (g)",
        "cystine": "Cystine (g)",
        "phenylalanine": "Phenylalanine (g)",
        "tyrosine": "Tyrosine (g)",
        "valine": "Valine (g)",
        "histidine": "Histidine (g)",
        # Other
        "caffeine": "Caffeine (mg)",
        "alcohol": "Alcohol (g)",
        "water": "Water (g)",
    }

    # Group food logs by date and aggregate nutrients
    daily_nutrients: dict[date, dict[str, float]] = {}
    for log in food_logs:
        log_date = log.logged_at.date()
        if log_date not in daily_nutrients:
            daily_nutrients[log_date] = {key: 0.0 for key in nutrients}

        for nutrient_key in nutrients:
            value = 0.0

            # First check if it's a model field
            if nutrient_key in nutrient_field_map:
                field_name = nutrient_field_map[nutrient_key]
                field_value = getattr(log, field_name, None)
                if field_value is not None:
                    value = float(field_value)
            # Next, try the friendly-to-cronometer mapping
            elif nutrient_key in friendly_to_cronometer and log.raw_data:
                cronometer_key = friendly_to_cronometer[nutrient_key]
                raw_value = log.raw_data.get(cronometer_key)
                if raw_value is not None:
                    try:
                        value = float(raw_value)
                    except (ValueError, TypeError):
                        value = 0.0
            # Finally, try direct raw_data key (for backwards compatibility)
            elif log.raw_data:
                raw_value = log.raw_data.get(nutrient_key)
                if raw_value is not None:
                    try:
                        value = float(raw_value)
                    except (ValueError, TypeError):
                        value = 0.0

            daily_nutrients[log_date][nutrient_key] += value

    # Group Bristol events by date
    daily_bristol: dict[date, list[BristolEvent]] = {}
    for note in health_notes:
        note_date = note.logged_at.date()
        if note_date not in daily_bristol:
            daily_bristol[note_date] = []

        daily_bristol[note_date].append(
            BristolEvent(
                timestamp=note.logged_at,
                bristol_score=note.bristol_scale,  # type: ignore[arg-type]
                quantity_score=note.quantity_score,
            )
        )

    # Build the daily data list, ensuring all dates in range are included
    daily_data: list[DailyTimelineData] = []
    current_date = start_date

    while current_date <= end_date:
        daily_data.append(
            DailyTimelineData(
                day=current_date,
                nutrients=daily_nutrients.get(current_date, {key: 0.0 for key in nutrients}),
                bristol_events=daily_bristol.get(current_date, []),
            )
        )
        current_date += timedelta(days=1)

    logger.info(
        "Timeline data retrieved",
        user_id=str(current_user.id),
        start_date=str(start_date),
        end_date=str(end_date),
        total_food_logs=len(food_logs),
        total_bristol_events=len(health_notes),
        days_in_range=len(daily_data),
    )

    return TimelineResponse(
        start_date=start_date,
        end_date=end_date,
        nutrient_keys=nutrients,
        daily_data=daily_data,
    )


@router.get("/insights/granger", response_model=GrangerResponse)
async def get_granger_causality(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    nutrients: list[str] = Query(
        default=["fiber_g", "protein_g", "carbs_g", "fat_g", "sugar_g"],
        description="List of nutrient keys to test",
    ),
    max_lag_days: int = Query(default=3, ge=1, le=7, description="Max lag days (1-7)"),
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> GrangerResponse:
    """Run Granger causality tests to determine if nutrient intake predicts Bristol outcomes.

    Granger causality tests whether past values of nutrient intake help predict
    future Bristol scores beyond what Bristol scores alone would predict.

    Args:
        start_date: Start date for analysis (inclusive).
        end_date: End date for analysis (inclusive).
        nutrients: List of nutrient keys to test for causality.
        max_lag_days: Maximum number of lag days to test (1-7).
        current_user: The authenticated user.
        db: Database session.

    Returns:
        Granger causality results sorted by p-value (most significant first).

    Raises:
        HTTPException: 400 if insufficient data for all nutrients.
    """
    granger_service = GrangerCausalityService(db)
    results: list[GrangerResultSchema] = []
    skipped_nutrients: list[str] = []

    for nutrient_key in nutrients:
        try:
            result = await granger_service.test_causality(
                user_id=current_user.id,
                nutrient_key=nutrient_key,
                start_date=start_date,
                end_date=end_date,
                max_lag_days=max_lag_days,
            )
            results.append(
                GrangerResultSchema(
                    nutrient_key=result.nutrient_key,
                    nutrient_name=result.nutrient_name,
                    f_statistic=result.f_statistic,
                    p_value=result.p_value,
                    optimal_lag=result.optimal_lag,
                    is_causal=result.is_causal,
                )
            )
        except GrangerInsufficientDataError as e:
            logger.warning(
                "Insufficient data for Granger test",
                user_id=str(current_user.id),
                nutrient_key=nutrient_key,
                error=str(e),
            )
            skipped_nutrients.append(nutrient_key)

    # If all nutrients failed, return 400
    if not results:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient data for Granger causality test. "
            f"Skipped nutrients: {skipped_nutrients}. "
            f"Ensure you have sufficient consecutive daily data for both "
            f"food logs and bowel movements in the date range.",
        )

    # Sort by p_value ascending (most significant first)
    results.sort(key=lambda r: r.p_value)

    causal_count = sum(1 for r in results if r.is_causal)

    logger.info(
        "Granger causality analysis completed",
        user_id=str(current_user.id),
        start_date=str(start_date),
        end_date=str(end_date),
        nutrients_tested=len(results),
        causal_count=causal_count,
        skipped_nutrients=skipped_nutrients,
    )

    return GrangerResponse(
        start_date=start_date,
        end_date=end_date,
        nutrients_tested=len(results),
        causal_nutrients_count=causal_count,
        results=results,
    )


@router.get("/insights/compare", response_model=ComparisonResultSchema)
async def get_controlled_comparison(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    nutrient_key: str = Query(..., description="Nutrient to analyze (e.g., 'fiber_g')"),
    control_factors: list[str] = Query(
        default=["calories"],
        description="Factors to control for",
    ),
    min_matched_pairs: int = Query(
        default=5, ge=3, le=50, description="Min matched pairs required"
    ),
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> ComparisonResultSchema:
    """Run controlled comparison of Bristol outcomes on high vs low nutrient intake days.

    This endpoint performs a controlled comparison analysis:
    1. Splits days into high (top quartile) and low (bottom quartile) nutrient intake
    2. Matches days with similar values for control factors
    3. Compares average Bristol scores between matched groups
    4. Calculates 95% confidence interval for the difference

    Args:
        start_date: Start date for analysis (inclusive).
        end_date: End date for analysis (inclusive).
        nutrient_key: Nutrient to analyze (e.g., "fiber_g", "protein_g").
        control_factors: Other nutrients to control for (default: ["calories"]).
        min_matched_pairs: Minimum number of matched pairs required (3-50).
        current_user: The authenticated user.
        db: Database session.

    Returns:
        Comparison result with statistics including confidence interval.

    Raises:
        HTTPException: 400 if insufficient matched pairs found.
    """
    comparison_service = ControlledComparisonService(db)

    try:
        result = await comparison_service.compare(
            user_id=current_user.id,
            nutrient_key=nutrient_key,
            start_date=start_date,
            end_date=end_date,
            control_factors=control_factors,
            min_matched_pairs=min_matched_pairs,
        )
    except InsufficientMatchesError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    logger.info(
        "Controlled comparison completed",
        user_id=str(current_user.id),
        nutrient_key=nutrient_key,
        start_date=str(start_date),
        end_date=str(end_date),
        matched_pairs=result.matched_pairs_count,
        is_significant=result.is_significant,
    )

    return ComparisonResultSchema(
        nutrient_key=result.nutrient_key,
        nutrient_name=result.nutrient_name,
        avg_bristol_high_intake=result.avg_bristol_high_intake,
        avg_bristol_low_intake=result.avg_bristol_low_intake,
        difference=result.difference,
        confidence_interval_low=result.confidence_interval_low,
        confidence_interval_high=result.confidence_interval_high,
        high_intake_count=result.high_intake_count,
        low_intake_count=result.low_intake_count,
        matched_pairs_count=result.matched_pairs_count,
        is_significant=result.is_significant,
    )


@router.get("/insights/foods", response_model=FoodAnalysisResponseSchema)
async def get_food_correlations(
    start_date: date = Query(..., description="Start date for analysis"),
    end_date: date = Query(..., description="End date for analysis"),
    min_occurrences: int = Query(default=3, ge=1, le=20, description="Min times food eaten"),
    time_lag_hours: int = Query(default=24, ge=6, le=72, description="Hours after eating to check"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_or_create_user),
) -> FoodAnalysisResponseSchema:
    """
    Analyze correlations between specific foods and Bristol outcomes.

    Returns foods sorted by correlation strength, with trigger foods highlighted.
    """
    logger.info(
        "Running food correlation analysis",
        user_id=str(current_user.id),
        start_date=str(start_date),
        end_date=str(end_date),
        min_occurrences=min_occurrences,
        time_lag_hours=time_lag_hours,
    )

    service = FoodCorrelationService(db)

    try:
        result = await service.analyze_foods(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            min_occurrences=min_occurrences,
            time_lag_hours=time_lag_hours,
        )
    except FoodInsufficientDataError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    logger.info(
        "Food correlation analysis completed",
        user_id=str(current_user.id),
        foods_analyzed=result.total_foods_analyzed,
        trigger_foods=len(result.trigger_foods),
    )

    # Convert dataclass results to Pydantic schemas
    results_schemas = [
        FoodCorrelationResultSchema(
            food_name=r.food_name,
            times_eaten=r.times_eaten,
            avg_bristol_after=r.avg_bristol_after,
            correlation=r.correlation,
            p_value=r.p_value,
            is_significant=r.is_significant,
            is_trigger=r.is_trigger,
            avg_bristol_when_eaten=r.avg_bristol_when_eaten,
            avg_bristol_when_not_eaten=r.avg_bristol_when_not_eaten,
        )
        for r in result.results
    ]

    trigger_schemas = [
        FoodCorrelationResultSchema(
            food_name=r.food_name,
            times_eaten=r.times_eaten,
            avg_bristol_after=r.avg_bristol_after,
            correlation=r.correlation,
            p_value=r.p_value,
            is_significant=r.is_significant,
            is_trigger=r.is_trigger,
            avg_bristol_when_eaten=r.avg_bristol_when_eaten,
            avg_bristol_when_not_eaten=r.avg_bristol_when_not_eaten,
        )
        for r in result.trigger_foods
    ]

    return FoodAnalysisResponseSchema(
        total_foods_analyzed=result.total_foods_analyzed,
        total_food_logs=result.total_food_logs,
        total_bristol_events=result.total_bristol_events,
        analysis_start_date=result.analysis_start_date,
        analysis_end_date=result.analysis_end_date,
        results=results_schemas,
        trigger_foods=trigger_schemas,
    )


@router.get("/insights/optimal-ranges", response_model=OptimalRangesResponseSchema)
async def get_optimal_ranges(
    start_date: date = Query(..., description="Start date for analysis"),
    end_date: date = Query(..., description="End date for analysis"),
    target_bristol: float = Query(default=4.0, ge=1.0, le=7.0, description="Target Bristol score"),
    tolerance: float = Query(default=1.0, ge=0.5, le=2.0, description="Acceptable deviation"),
    min_samples: int = Query(default=5, ge=3, le=20, description="Minimum samples per decile"),
    time_lag_hours: int = Query(
        default=24, ge=12, le=48, description="Hours after eating to check"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_or_create_user),
) -> OptimalRangesResponseSchema:
    """
    Find personalized optimal nutrient intake ranges based on Bristol outcomes.

    Analyzes nutrient intake data to find ranges where Bristol scores are closest
    to the target (default: 4, which is ideal). Uses decile-based analysis to
    identify intake ranges that correlate with optimal digestive outcomes.

    Args:
        start_date: Start date for analysis (inclusive).
        end_date: End date for analysis (inclusive).
        target_bristol: Target Bristol score (1-7, default 4).
        tolerance: Acceptable deviation from target (default 1).
        min_samples: Minimum samples required per decile (default 5).
        time_lag_hours: Hours after eating to check Bristol (default 24).

    Returns:
        Optimal ranges for each analyzed nutrient, sorted by confidence score.

    Raises:
        HTTPException: 400 if insufficient data for analysis.
    """
    logger.info(
        "Running optimal ranges analysis",
        user_id=str(current_user.id),
        start_date=str(start_date),
        end_date=str(end_date),
        target_bristol=target_bristol,
        tolerance=tolerance,
    )

    service = OptimalRangesService(db)

    try:
        result = await service.find_optimal_ranges(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            target_bristol=target_bristol,
            tolerance=tolerance,
            min_samples=min_samples,
            time_lag_hours=time_lag_hours,
        )
    except OptimalRangesInsufficientDataError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    logger.info(
        "Optimal ranges analysis completed",
        user_id=str(current_user.id),
        nutrients_analyzed=result.total_nutrients_analyzed,
        food_logs=result.total_food_logs,
        bristol_events=result.total_bristol_events,
    )

    # Convert dataclass results to Pydantic schemas
    range_schemas = [
        OptimalRangeSchema(
            nutrient_name=r.nutrient_name,
            nutrient_key=r.nutrient_key,
            optimal_min=r.optimal_min,
            optimal_max=r.optimal_max,
            avg_bristol_in_range=r.avg_bristol_in_range,
            sample_size=r.sample_size,
            confidence_score=r.confidence_score,
            unit=r.unit,
        )
        for r in result.ranges
    ]

    return OptimalRangesResponseSchema(
        total_nutrients_analyzed=result.total_nutrients_analyzed,
        total_food_logs=result.total_food_logs,
        total_bristol_events=result.total_bristol_events,
        target_bristol=result.target_bristol,
        tolerance=result.tolerance,
        analysis_start_date=result.analysis_start_date,
        analysis_end_date=result.analysis_end_date,
        ranges=range_schemas,
    )
