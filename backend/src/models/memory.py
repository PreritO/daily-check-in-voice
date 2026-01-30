"""ConversationMemory database model."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .call import Call
    from .user import User


class MemoryType(enum.Enum):
    """Enumeration of possible memory types."""

    FACT = "fact"
    PREFERENCE = "preference"
    EVENT = "event"
    RELATIONSHIP = "relationship"


class ConversationMemory(Base):
    """ConversationMemory model for storing user context and memories from calls."""

    __tablename__ = "conversation_memories"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    memory_type: Mapped[MemoryType] = mapped_column(
        Enum(MemoryType, native_enum=False, length=20),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    source_call_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("calls.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    importance: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="memories",
    )
    source_call: Mapped["Call | None"] = relationship(
        "Call",
        back_populates="memories",
    )

    def __repr__(self) -> str:
        """Return string representation of ConversationMemory."""
        return (
            f"<ConversationMemory(id={self.id}, user_id={self.user_id}, "
            f"memory_type={self.memory_type.value!r}, importance={self.importance})>"
        )
