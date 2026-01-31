"""FoodLog database model."""

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .user import User


class FoodLog(Base):
    """FoodLog model for storing Cronometer food entries."""

    __tablename__ = "food_logs"

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
    food_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    serving_size: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    food_group: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    # Nutritional data
    calories: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    protein_g: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    carbs_g: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    fat_g: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    fiber_g: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    sugar_g: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    sodium_mg: Mapped[float | None] = mapped_column(
        Float,
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
        back_populates="food_logs",
    )

    def __repr__(self) -> str:
        """Return string representation of FoodLog."""
        return (
            f"<FoodLog(id={self.id}, user_id={self.user_id}, "
            f"food_name={self.food_name!r}, logged_at={self.logged_at})>"
        )
