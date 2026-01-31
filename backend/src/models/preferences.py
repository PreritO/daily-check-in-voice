"""User preferences database model."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .user import User


class CommunicationStyle(enum.Enum):
    """Enumeration of communication style preferences."""

    CASUAL = "casual"
    FORMAL = "formal"
    FRIENDLY = "friendly"


class CallDurationPreference(enum.Enum):
    """Enumeration of call duration preferences."""

    SHORT = "short"
    MEDIUM = "medium"
    LONG = "long"


class ThemeMode(enum.Enum):
    """Enumeration of theme mode preferences."""

    LIGHT = "light"
    DARK = "dark"
    SYSTEM = "system"


class UserPreferences(Base):
    """User preferences model for storing personalization settings."""

    __tablename__ = "user_preferences"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    conversation_topics: Mapped[list[str]] = mapped_column(
        JSON,
        server_default="[]",
        nullable=False,
    )
    interests: Mapped[list[str]] = mapped_column(
        JSON,
        server_default="[]",
        nullable=False,
    )
    communication_style: Mapped[CommunicationStyle] = mapped_column(
        Enum(
            CommunicationStyle,
            native_enum=False,
            length=20,
            values_callable=lambda x: [e.value for e in x],
        ),
        server_default=CommunicationStyle.FRIENDLY.value,
        nullable=False,
    )
    call_duration_preference: Mapped[CallDurationPreference] = mapped_column(
        Enum(
            CallDurationPreference,
            native_enum=False,
            length=20,
            values_callable=lambda x: [e.value for e in x],
        ),
        server_default=CallDurationPreference.MEDIUM.value,
        nullable=False,
    )
    theme_mode: Mapped[ThemeMode] = mapped_column(
        Enum(
            ThemeMode,
            native_enum=False,
            length=10,
            values_callable=lambda x: [e.value for e in x],
        ),
        server_default=ThemeMode.SYSTEM.value,
        nullable=False,
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
        back_populates="preferences",
    )

    def __repr__(self) -> str:
        """Return string representation of UserPreferences."""
        return (
            f"<UserPreferences(id={self.id}, user_id={self.user_id}, "
            f"communication_style={self.communication_style.value!r}, "
            f"call_duration_preference={self.call_duration_preference.value!r})>"
        )
