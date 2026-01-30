"""MoodAnalysis database model."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import JSON, Enum, Float, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .call import Call


class SentimentType(enum.Enum):
    """Enumeration of possible sentiment types for mood analysis."""

    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    CONCERNED = "concerned"


class MoodAnalysis(Base):
    """MoodAnalysis model for storing sentiment analysis of standup calls."""

    __tablename__ = "mood_analyses"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    call_id: Mapped[UUID] = mapped_column(
        ForeignKey("calls.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    overall_sentiment: Mapped[SentimentType] = mapped_column(
        Enum(SentimentType, native_enum=False, length=20),
        nullable=False,
    )
    confidence: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    flags: Mapped[list[str]] = mapped_column(
        JSON,
        server_default="[]",
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    analyzed_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    call: Mapped["Call"] = relationship(
        "Call",
        back_populates="mood_analysis",
    )

    def __repr__(self) -> str:
        """Return string representation of MoodAnalysis."""
        return (
            f"<MoodAnalysis(id={self.id}, call_id={self.call_id}, "
            f"overall_sentiment={self.overall_sentiment.value!r}, confidence={self.confidence})>"
        )
