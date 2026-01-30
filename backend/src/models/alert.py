"""Alert database model."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .call import Call
    from .user import User


class AlertType(enum.Enum):
    """Enumeration of possible alert types."""

    MOOD_CONCERN = "mood_concern"
    MISSED_CALLS = "missed_calls"


class Alert(Base):
    """Alert model for storing notifications about user activity."""

    __tablename__ = "alerts"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    call_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("calls.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    alert_type: Mapped[AlertType] = mapped_column(
        Enum(AlertType, native_enum=False, length=20),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    acknowledged: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="alerts",
    )
    call: Mapped["Call | None"] = relationship(
        "Call",
        back_populates="alerts",
    )

    def __repr__(self) -> str:
        """Return string representation of Alert."""
        return (
            f"<Alert(id={self.id}, user_id={self.user_id}, "
            f"alert_type={self.alert_type.value!r}, acknowledged={self.acknowledged})>"
        )
