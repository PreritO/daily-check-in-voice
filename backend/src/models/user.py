"""User database model."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .call import Call
    from .schedule import Schedule


class User(Base):
    """User model for storing user account information."""

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    auth_id: Mapped[str | None] = mapped_column(
        String(36),
        unique=True,
        index=True,
        nullable=True,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    timezone: Mapped[str] = mapped_column(
        String(50),
        server_default="UTC",
        nullable=False,
    )
    phone_number: Mapped[str | None] = mapped_column(
        String(20),
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
    calls: Mapped[list["Call"]] = relationship(
        "Call",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    schedules: Mapped[list["Schedule"]] = relationship(
        "Schedule",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        """Return string representation of User."""
        return f"<User(id={self.id}, email={self.email!r}, name={self.name!r})>"
