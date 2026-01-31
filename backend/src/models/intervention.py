"""Intervention database model for tracking dietary experiments."""

import enum
from datetime import date, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .user import User


class InterventionStatus(str, enum.Enum):
    """Status of a dietary intervention."""

    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Intervention(Base):
    """Intervention model for tracking user dietary experiments."""

    __tablename__ = "interventions"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    hypothesis: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    nutrient_key: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    target_value: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    end_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    status: Mapped[InterventionStatus] = mapped_column(
        default=InterventionStatus.PLANNED,
        server_default="planned",
        nullable=False,
    )
    outcome_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="interventions",
    )

    def __repr__(self) -> str:
        """Return string representation of Intervention."""
        return (
            f"<Intervention(id={self.id}, user_id={self.user_id}, "
            f"title={self.title!r}, status={self.status.value})>"
        )
