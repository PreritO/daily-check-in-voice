"""ExerciseLog database model."""

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .user import User


class ExerciseLog(Base):
    """ExerciseLog model for storing Cronometer exercise/workout entries."""

    __tablename__ = "exercise_logs"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    duration_minutes: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    calories_burned: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    raw_data: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )
    cronometer_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="exercise_logs",
    )

    def __repr__(self) -> str:
        """Return string representation of ExerciseLog."""
        return (
            f"<ExerciseLog(id={self.id}, user_id={self.user_id}, "
            f"name={self.name!r}, logged_at={self.logged_at})>"
        )
