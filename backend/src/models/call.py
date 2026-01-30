"""Call database model."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .memory import ConversationMemory
    from .mood import MoodAnalysis
    from .summary import Summary
    from .transcript import Transcript
    from .user import User


class CallStatus(enum.Enum):
    """Enumeration of possible call statuses."""

    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class CallDirection(enum.Enum):
    """Enumeration of call directions."""

    INBOUND = "inbound"
    OUTBOUND = "outbound"


class Call(Base):
    """Call model for storing standup call information."""

    __tablename__ = "calls"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    status: Mapped[CallStatus] = mapped_column(
        Enum(CallStatus, native_enum=False, length=20),
        default=CallStatus.SCHEDULED,
        nullable=False,
    )
    direction: Mapped[CallDirection] = mapped_column(
        Enum(CallDirection, native_enum=False, length=20),
        default=CallDirection.OUTBOUND,
        nullable=False,
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="calls",
    )
    transcripts: Mapped[list["Transcript"]] = relationship(
        "Transcript",
        back_populates="call",
        cascade="all, delete-orphan",
        order_by="Transcript.timestamp_ms",
    )
    summary: Mapped["Summary | None"] = relationship(
        "Summary",
        back_populates="call",
        uselist=False,
        cascade="all, delete-orphan",
    )
    memories: Mapped[list["ConversationMemory"]] = relationship(
        "ConversationMemory",
        back_populates="source_call",
    )
    mood_analysis: Mapped["MoodAnalysis | None"] = relationship(
        "MoodAnalysis",
        back_populates="call",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        """Return string representation of Call."""
        return f"<Call(id={self.id}, user_id={self.user_id}, status={self.status.value!r})>"
