"""Pydantic v2 API schemas for the Daily Check-In Agent."""

import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from src.models import CallStatus, Speaker

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
