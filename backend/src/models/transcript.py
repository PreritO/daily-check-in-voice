"""Transcript database model."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .call import Call


class Speaker(enum.Enum):
    """Enumeration of transcript speakers."""

    AGENT = "agent"
    USER = "user"


class Transcript(Base):
    """Transcript model for storing conversation transcript entries."""

    __tablename__ = "transcripts"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    call_id: Mapped[UUID] = mapped_column(
        ForeignKey("calls.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    speaker: Mapped[Speaker] = mapped_column(
        Enum(Speaker, native_enum=False, length=10),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    timestamp_ms: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    call: Mapped["Call"] = relationship(
        "Call",
        back_populates="transcripts",
    )

    def __repr__(self) -> str:
        """Return string representation of Transcript."""
        return f"<Transcript(id={self.id}, call_id={self.call_id}, speaker={self.speaker.value!r})>"
