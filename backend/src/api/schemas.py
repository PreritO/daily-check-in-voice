"""Pydantic v2 API schemas for the Daily Check-In Agent."""

import re
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from src.models import (
    AlertType,
    CallDirection,
    CallStatus,
    InterventionStatus,
    MemoryType,
    SentimentType,
    Speaker,
)
from src.models.preferences import CallDurationPreference, CommunicationStyle, ThemeMode

# =============================================================================
# User Schemas
# =============================================================================


class UserCreate(BaseModel):
    """Schema for creating a new user."""

    email: EmailStr = Field(..., description="User's email address")
    name: str = Field(..., max_length=100, description="User's display name")
    timezone: str = Field(default="UTC", max_length=50, description="User's timezone")
    phone_number: str | None = Field(
        default=None, max_length=20, description="User's phone number for calls"
    )


class UserRead(BaseModel):
    """Schema for reading user data."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    auth_id: str | None
    email: EmailStr
    name: str
    timezone: str
    phone_number: str | None
    created_at: datetime
    updated_at: datetime


class UserUpdate(BaseModel):
    """Schema for updating user data. All fields are optional."""

    email: EmailStr | None = Field(default=None, description="User's email address")
    name: str | None = Field(default=None, max_length=100, description="User's display name")
    timezone: str | None = Field(default=None, max_length=50, description="User's timezone")
    phone_number: str | None = Field(
        default=None, max_length=20, description="User's phone number for calls"
    )


# =============================================================================
# Call Schemas
# =============================================================================


class CallCreate(BaseModel):
    """Schema for creating a new call."""

    user_id: UUID = Field(..., description="ID of the user for this call")
    scheduled_at: datetime | None = Field(
        default=None, description="When the call is scheduled for"
    )
    status: CallStatus = Field(
        default=CallStatus.SCHEDULED, description="Initial status of the call"
    )


class CallRead(BaseModel):
    """Schema for reading call data."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    status: CallStatus
    direction: CallDirection
    scheduled_at: datetime | None
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime
    updated_at: datetime


class CallUpdate(BaseModel):
    """Schema for updating call data. All fields are optional."""

    status: CallStatus | None = Field(default=None, description="Call status")
    scheduled_at: datetime | None = Field(default=None, description="Scheduled time")
    started_at: datetime | None = Field(default=None, description="When the call started")
    ended_at: datetime | None = Field(default=None, description="When the call ended")


# =============================================================================
# Transcript Schemas
# =============================================================================


class TranscriptRead(BaseModel):
    """Schema for reading transcript data. Read-only as transcripts are created internally."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    call_id: UUID
    speaker: Speaker
    content: str
    timestamp_ms: int = Field(..., ge=0, description="Timestamp in milliseconds from call start")
    created_at: datetime


# =============================================================================
# Summary Schemas
# =============================================================================


class SummaryRead(BaseModel):
    """Schema for reading summary data. Read-only as summaries are generated internally."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    call_id: UUID
    yesterday: str
    today: str
    blockers: str | None
    raw_summary: str
    posted_to_slack: bool
    slack_message_id: str | None
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Mood Analysis Schemas
# =============================================================================


class MoodAnalysisRead(BaseModel):
    """Schema for reading mood analysis data."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    call_id: UUID
    overall_sentiment: SentimentType
    confidence: float
    flags: list[str]
    notes: str | None
    analyzed_at: datetime


# =============================================================================
# Memory Schemas
# =============================================================================


class MemoryRead(BaseModel):
    """Schema for reading memory data."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    memory_type: MemoryType
    content: str
    source_call_id: UUID | None
    importance: int
    created_at: datetime


# =============================================================================
# Call Detail Schema (with nested data)
# =============================================================================


class CallReadWithDetails(BaseModel):
    """Schema for reading call data with nested transcripts and summary."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    status: CallStatus
    direction: CallDirection
    scheduled_at: datetime | None
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime
    updated_at: datetime
    transcripts: list[TranscriptRead] = Field(default_factory=list)
    summary: SummaryRead | None = None
    mood_analysis: MoodAnalysisRead | None = None
    memories: list[MemoryRead] = Field(default_factory=list)


# =============================================================================
# Schedule Schemas
# =============================================================================


class ScheduleCreate(BaseModel):
    """Schema for creating a new schedule."""

    user_id: UUID = Field(..., description="ID of the user for this schedule")
    cron_expression: str = Field(
        ..., max_length=100, description="Cron expression for scheduling (5 fields)"
    )
    enabled: bool = Field(default=True, description="Whether the schedule is active")

    @field_validator("cron_expression")
    @classmethod
    def validate_cron_expression(cls, v: str) -> str:
        """Validate that the cron expression has 5 fields and basic format."""
        v = v.strip()
        fields = v.split()
        if len(fields) != 5:
            raise ValueError("Cron expression must have exactly 5 fields")
        # Basic format validation - allow common patterns
        for field in fields:
            if not re.match(r"^(\*|[0-9]+|\*/[0-9]+|[0-9]+-[0-9]+|([0-9]+,)+[0-9]+)$", field):
                raise ValueError(f"Invalid cron field format: {field}")
        return v


class ScheduleRead(BaseModel):
    """Schema for reading schedule data."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    enabled: bool
    cron_expression: str
    next_run_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ScheduleUpdate(BaseModel):
    """Schema for updating schedule data. All fields are optional."""

    enabled: bool | None = Field(default=None, description="Whether the schedule is active")
    cron_expression: str | None = Field(
        default=None, max_length=100, description="Cron expression for scheduling"
    )

    @field_validator("cron_expression")
    @classmethod
    def validate_cron_expression(cls, v: str | None) -> str | None:
        """Validate that the cron expression has 5 fields and basic format."""
        if v is None:
            return v
        v = v.strip()
        fields = v.split()
        if len(fields) != 5:
            raise ValueError("Cron expression must have exactly 5 fields")
        # Basic format validation - allow common patterns
        for field in fields:
            if not re.match(r"^(\*|[0-9]+|\*/[0-9]+|[0-9]+-[0-9]+|([0-9]+,)+[0-9]+)$", field):
                raise ValueError(f"Invalid cron field format: {field}")
        return v


# =============================================================================
# Call Trigger Schemas
# =============================================================================


class CallTriggerRequest(BaseModel):
    """Schema for triggering a manual call."""

    user_id: UUID = Field(..., description="ID of the user to call")


class CallTriggerResponse(BaseModel):
    """Schema for call trigger response with LiveKit connection info."""

    call_id: UUID = Field(..., description="ID of the created call")
    room_name: str = Field(..., description="LiveKit room name")
    token: str = Field(..., description="LiveKit access token for the participant")
    livekit_url: str = Field(..., description="LiveKit server URL")


# =============================================================================
# Preference Schemas
# =============================================================================


class PreferencesRead(BaseModel):
    """Schema for reading user preferences."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    conversation_topics: list[str]
    interests: list[str]
    communication_style: CommunicationStyle
    call_duration_preference: CallDurationPreference
    theme_mode: ThemeMode
    created_at: datetime
    updated_at: datetime


class PreferencesUpsert(BaseModel):
    """Schema for creating or updating user preferences (upsert).

    All fields are optional - missing fields will use defaults on create
    or remain unchanged on update.
    """

    conversation_topics: list[str] | None = Field(
        default=None, description="Topics the user wants to discuss"
    )
    interests: list[str] | None = Field(
        default=None, description="User's interests for personalization"
    )
    communication_style: CommunicationStyle | None = Field(
        default=None, description="Preferred communication style"
    )
    call_duration_preference: CallDurationPreference | None = Field(
        default=None, description="Preferred call duration"
    )
    theme_mode: ThemeMode | None = Field(
        default=None, description="UI theme mode preference (light/dark/system)"
    )


# =============================================================================
# Analytics Schemas
# =============================================================================


class MoodTrendItemRead(BaseModel):
    """Single data point in the user's mood trend."""

    model_config = ConfigDict(from_attributes=True)

    call_date: date
    sentiment: SentimentType
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0-1")


class UserAnalyticsRead(BaseModel):
    """Aggregated analytics for a user's call history."""

    model_config = ConfigDict(from_attributes=True)

    total_calls: int = Field(..., ge=0, description="Total number of completed calls")
    total_duration_minutes: float = Field(..., ge=0.0, description="Total call time in minutes")
    average_call_duration: float = Field(
        ..., ge=0.0, description="Average call duration in minutes"
    )
    calls_this_week: int = Field(..., ge=0, description="Completed calls this week")
    calls_this_month: int = Field(..., ge=0, description="Completed calls this month")
    mood_trend: list[MoodTrendItemRead] = Field(
        default_factory=list, description="Recent mood data points"
    )
    streak_days: int = Field(..., ge=0, description="Current consecutive days with calls")


# =============================================================================
# Alert Schemas
# =============================================================================


class AlertRead(BaseModel):
    """Schema for reading alert data."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    call_id: UUID | None
    alert_type: AlertType
    title: str
    message: str
    acknowledged: bool
    acknowledged_at: datetime | None
    created_at: datetime


class AlertAcknowledge(BaseModel):
    """Schema for acknowledging an alert."""

    acknowledged: bool = Field(default=True, description="Acknowledge status")


# =============================================================================
# Cronometer Schemas
# =============================================================================


class SaveCredentialsRequest(BaseModel):
    """Schema for saving Cronometer credentials."""

    email: EmailStr = Field(..., description="Cronometer account email")
    password: str = Field(..., min_length=1, description="Cronometer account password")


class SyncRequest(BaseModel):
    """Schema for requesting a Cronometer sync."""

    days_back: int = Field(default=7, ge=1, le=90, description="Number of days to sync (1-90)")


class SyncResponse(BaseModel):
    """Schema for Cronometer sync response."""

    food_logs_synced: int = Field(..., ge=0, description="Number of food logs synced")
    biometric_logs_synced: int = Field(..., ge=0, description="Number of biometric logs synced")
    health_notes_synced: int = Field(..., ge=0, description="Number of health notes synced")
    synced_at: datetime = Field(..., description="Timestamp of sync completion")


class FoodLogResponse(BaseModel):
    """Schema for reading food log data."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    logged_at: datetime
    food_name: str
    serving_size: str
    food_group: str | None
    calories: float | None
    protein_g: float | None
    carbs_g: float | None
    fat_g: float | None
    fiber_g: float | None
    sugar_g: float | None
    sodium_mg: float | None
    created_at: datetime


class HealthNoteResponse(BaseModel):
    """Schema for reading health note data including parsed BM data."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    logged_at: datetime
    content: str
    is_bowel_movement: bool
    bristol_scale: int | None
    quantity_score: int | None
    created_at: datetime


class CredentialStatusResponse(BaseModel):
    """Schema for Cronometer credentials status."""

    has_credentials: bool = Field(..., description="Whether credentials are saved")
    last_sync_at: datetime | None = Field(None, description="Timestamp of last sync")


# =============================================================================
# Timeline Schemas
# =============================================================================


class BristolEvent(BaseModel):
    """A single Bristol stool event."""

    timestamp: datetime = Field(..., description="When the BM event occurred")
    bristol_score: int = Field(..., ge=1, le=7, description="Bristol scale score (1-7)")
    quantity_score: int | None = Field(None, ge=1, le=5, description="Quantity score (1-5)")


class DailyTimelineData(BaseModel):
    """Daily aggregated nutrient and Bristol data."""

    day: date = Field(..., description="The date for this data point")
    nutrients: dict[str, float] = Field(
        default_factory=dict, description="Nutrient key -> total value for the day"
    )
    bristol_events: list[BristolEvent] = Field(
        default_factory=list, description="All BM events that day"
    )


class TimelineResponse(BaseModel):
    """Response for the timeline endpoint."""

    start_date: date = Field(..., description="Start date of the timeline")
    end_date: date = Field(..., description="End date of the timeline")
    nutrient_keys: list[str] = Field(
        default_factory=list, description="List of nutrient keys included"
    )
    daily_data: list[DailyTimelineData] = Field(
        default_factory=list, description="One entry per day, sorted ascending"
    )


# =============================================================================
# Insights Schemas
# =============================================================================


class GrangerResultSchema(BaseModel):
    """Schema for Granger causality test result."""

    nutrient_key: str = Field(..., description="Nutrient identifier")
    nutrient_name: str = Field(..., description="Human-readable nutrient name")
    f_statistic: float = Field(..., description="F-test statistic")
    p_value: float = Field(..., description="P-value from Granger test")
    optimal_lag: int = Field(..., description="Optimal lag in days")
    is_causal: bool = Field(..., description="True if p < 0.05")


class GrangerResponse(BaseModel):
    """Response for Granger causality endpoint."""

    start_date: date
    end_date: date
    nutrients_tested: int
    causal_nutrients_count: int
    results: list[GrangerResultSchema]  # Sorted by p_value ascending (most significant first)


class CorrelationResultSchema(BaseModel):
    """Schema for a single nutrient correlation result."""

    nutrient_name: str = Field(..., description="Human-readable nutrient name")
    nutrient_key: str = Field(..., description="Internal nutrient key")
    time_lag_hours: int = Field(..., description="Time lag window in hours")
    correlation_coefficient: float = Field(..., description="Pearson correlation coefficient")
    p_value: float = Field(..., description="Statistical p-value")
    sample_size: int = Field(..., description="Number of data points analyzed")
    is_significant: bool = Field(..., description="Whether p < 0.05")
    avg_bristol_high_intake: float | None = Field(
        None, description="Avg Bristol score when intake is high"
    )
    avg_bristol_low_intake: float | None = Field(
        None, description="Avg Bristol score when intake is low"
    )
    intake_high_threshold: float | None = Field(None, description="75th percentile intake")
    intake_low_threshold: float | None = Field(None, description="25th percentile intake")
    direction: str = Field(..., description="Correlation direction: positive, negative, or none")
    interpretation: str = Field("", description="Human-readable interpretation of the correlation")


class ConsistentCorrelationSchema(BaseModel):
    """Schema for a nutrient with consistent correlation across time windows."""

    nutrient_name: str = Field(..., description="Human-readable nutrient name")
    nutrient_key: str = Field(..., description="Internal nutrient key")
    windows_significant: int = Field(..., description="Number of windows with significance")
    avg_correlation: float = Field(..., description="Average correlation coefficient")
    direction: str = Field(..., description="Overall direction: positive, negative, or mixed")


class ComparisonResultSchema(BaseModel):
    """Schema for controlled comparison result."""

    nutrient_key: str = Field(..., description="Nutrient identifier")
    nutrient_name: str = Field(..., description="Human-readable nutrient name")
    avg_bristol_high_intake: float = Field(..., description="Avg Bristol on high intake days")
    avg_bristol_low_intake: float = Field(..., description="Avg Bristol on low intake days")
    difference: float = Field(..., description="Difference (high - low)")
    confidence_interval_low: float = Field(..., description="95% CI lower bound")
    confidence_interval_high: float = Field(..., description="95% CI upper bound")
    high_intake_count: int = Field(..., description="Sample size for high intake")
    low_intake_count: int = Field(..., description="Sample size for low intake")
    matched_pairs_count: int = Field(..., description="Number of matched day-pairs")
    is_significant: bool = Field(..., description="True if statistically significant")


class MultiLagCorrelationResponseSchema(BaseModel):
    """Schema for the complete correlation analysis response."""

    baseline_bristol_score: float = Field(..., description="Average Bristol score")
    total_bowel_movements: int = Field(..., description="Total BMs analyzed")
    total_food_logs: int = Field(..., description="Total food logs analyzed")
    analysis_start_date: date = Field(..., description="Start of analysis period")
    analysis_end_date: date = Field(..., description="End of analysis period")
    results_by_lag: dict[int, list[CorrelationResultSchema]] = Field(
        default_factory=dict, description="Results keyed by time lag hours"
    )
    consistent_correlations: list[ConsistentCorrelationSchema] = Field(
        default_factory=list, description="Nutrients with consistent correlations"
    )
    insights: list[str] = Field(default_factory=list, description="Human-readable insights")


# =============================================================================
# Food Correlation Schemas
# =============================================================================


class FoodCorrelationResultSchema(BaseModel):
    """Schema for a single food correlation result."""

    food_name: str = Field(..., description="Name of the food")
    times_eaten: int = Field(..., description="Number of times food was eaten")
    avg_bristol_after: float | None = Field(None, description="Avg Bristol after eating")
    correlation: float = Field(..., description="Correlation coefficient")
    p_value: float = Field(..., description="Statistical p-value")
    is_significant: bool = Field(..., description="True if p < 0.05")
    is_trigger: bool = Field(..., description="True if food is a trigger")
    avg_bristol_when_eaten: float | None = Field(None, description="Avg Bristol when food eaten")
    avg_bristol_when_not_eaten: float | None = Field(None, description="Avg Bristol when not eaten")


class FoodAnalysisResponseSchema(BaseModel):
    """Schema for food analysis response."""

    total_foods_analyzed: int = Field(..., description="Number of foods analyzed")
    total_food_logs: int = Field(..., description="Total food logs in period")
    total_bristol_events: int = Field(..., description="Total Bristol events in period")
    analysis_start_date: date = Field(..., description="Start of analysis period")
    analysis_end_date: date = Field(..., description="End of analysis period")
    results: list[FoodCorrelationResultSchema] = Field(
        default_factory=list, description="All food correlations"
    )
    trigger_foods: list[FoodCorrelationResultSchema] = Field(
        default_factory=list, description="Foods identified as triggers"
    )


# =============================================================================
# Optimal Ranges Schemas
# =============================================================================


class OptimalRangeSchema(BaseModel):
    """Schema for a single optimal nutrient range."""

    nutrient_name: str = Field(..., description="Human-readable nutrient name")
    nutrient_key: str = Field(..., description="Internal nutrient key")
    optimal_min: float = Field(..., description="Lower bound of optimal range")
    optimal_max: float = Field(..., description="Upper bound of optimal range")
    avg_bristol_in_range: float = Field(..., description="Avg Bristol when intake in range")
    sample_size: int = Field(..., description="Number of data points in range")
    confidence_score: float = Field(..., description="Confidence score 0-1")
    unit: str = Field(..., description="Unit of measurement (e.g., g, mg)")


class OptimalRangesResponseSchema(BaseModel):
    """Schema for optimal ranges response."""

    total_nutrients_analyzed: int = Field(..., description="Number of nutrients with ranges")
    total_food_logs: int = Field(..., description="Total food logs in period")
    total_bristol_events: int = Field(..., description="Total Bristol events in period")
    target_bristol: float = Field(..., description="Target Bristol score used")
    tolerance: float = Field(..., description="Tolerance from target")
    analysis_start_date: date = Field(..., description="Start of analysis period")
    analysis_end_date: date = Field(..., description="End of analysis period")
    ranges: list[OptimalRangeSchema] = Field(
        default_factory=list, description="Optimal ranges by nutrient"
    )


# =============================================================================
# Intervention Schemas
# =============================================================================


class InterventionCreate(BaseModel):
    """Schema for creating an intervention."""

    title: str = Field(..., max_length=200)
    description: str | None = None
    hypothesis: str | None = None
    nutrient_key: str | None = Field(None, max_length=100)
    target_value: float | None = None
    start_date: date
    end_date: date | None = None
    status: InterventionStatus = InterventionStatus.PLANNED


class InterventionUpdate(BaseModel):
    """Schema for updating an intervention."""

    title: str | None = Field(None, max_length=200)
    description: str | None = None
    hypothesis: str | None = None
    nutrient_key: str | None = Field(None, max_length=100)
    target_value: float | None = None
    end_date: date | None = None
    status: InterventionStatus | None = None
    outcome_notes: str | None = None


class InterventionRead(BaseModel):
    """Schema for reading intervention data."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str
    description: str | None
    hypothesis: str | None
    nutrient_key: str | None
    target_value: float | None
    start_date: date
    end_date: date | None
    status: InterventionStatus
    outcome_notes: str | None
    created_at: datetime
    updated_at: datetime


class InterventionWithAnalysis(InterventionRead):
    """Schema with Bristol comparison analysis."""

    avg_bristol_before: float | None = None  # Average Bristol before start_date
    avg_bristol_during: float | None = None  # Average Bristol during intervention
    bristol_difference: float | None = None  # during - before
    days_before_analyzed: int = 0
    days_during_analyzed: int = 0
