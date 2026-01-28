"""Summary database model."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .call import Call


class Summary(Base):
    """Summary model for storing AI-generated standup summaries."""

    __tablename__ = "summaries"

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
    yesterday: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    today: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    blockers: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    raw_summary: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    posted_to_slack: Mapped[bool] = mapped_column(
        Boolean,
        server_default="false",
        nullable=False,
    )
    slack_message_id: Mapped[str | None] = mapped_column(
        String(50),
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
    call: Mapped["Call"] = relationship(
        "Call",
        back_populates="summary",
    )

    def __repr__(self) -> str:
        """Return string representation of Summary."""
        return f"<Summary(id={self.id}, call_id={self.call_id}, posted_to_slack={self.posted_to_slack})>"
