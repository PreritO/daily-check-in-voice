"""HealthNote database model."""

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .user import User


class HealthNote(Base):
    """HealthNote model for storing notes including bowel movements."""

    __tablename__ = "health_notes"

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
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    is_bowel_movement: Mapped[bool] = mapped_column(
        Boolean,
        server_default="false",
        nullable=False,
    )
    bristol_scale: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    quantity_score: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    # Raw data from Cronometer API
    raw_data: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )
    # Deduplication hash
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
        back_populates="health_notes",
    )

    def __repr__(self) -> str:
        """Return string representation of HealthNote."""
        return (
            f"<HealthNote(id={self.id}, user_id={self.user_id}, "
            f"is_bowel_movement={self.is_bowel_movement}, logged_at={self.logged_at})>"
        )
