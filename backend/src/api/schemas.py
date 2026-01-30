"""Pydantic v2 API schemas for the Daily Check-In Agent."""

import re
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from src.models import CallStatus, MemoryType, SentimentType, Speaker
from src.models.preferences import CallDurationPreference, CommunicationStyle

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
