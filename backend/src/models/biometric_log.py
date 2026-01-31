"""BiometricLog database model."""

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import JSON, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .user import User


class BiometricLog(Base):
    """BiometricLog model for storing Cronometer biometric measurements."""

    __tablename__ = "biometric_logs"

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
        index=True,
        nullable=False,
    )
    metric_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    value: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    unit: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
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
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="biometric_logs",
    )

    def __repr__(self) -> str:
        """Return string representation of BiometricLog."""
        return (
            f"<BiometricLog(id={self.id}, user_id={self.user_id}, "
            f"metric_type={self.metric_type!r}, value={self.value}, logged_at={self.logged_at})>"
        )
