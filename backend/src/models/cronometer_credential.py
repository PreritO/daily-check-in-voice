"""Cronometer credential database model."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .user import User


class CronometerCredential(Base):
    """Cronometer credential model for storing encrypted user credentials."""

    __tablename__ = "cronometer_credentials"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    encrypted_email: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    encrypted_password: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    last_sync_at: Mapped[datetime | None] = mapped_column(
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
        back_populates="cronometer_credential",
    )

    def __repr__(self) -> str:
        """Return string representation of CronometerCredential."""
        return f"<CronometerCredential(id={self.id}, user_id={self.user_id}, last_sync_at={self.last_sync_at})>"
