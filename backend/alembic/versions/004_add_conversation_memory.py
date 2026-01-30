"""Add conversation_memories table.

Revision ID: 004_memory
Revises: 003_preferences
Create Date: 2026-01-29

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004_memory"
down_revision: str | Sequence[str] | None = "003_preferences"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create conversation_memories table."""
    op.create_table(
        "conversation_memories",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "memory_type",
            sa.Enum(
                "fact",
                "preference",
                "event",
                "relationship",
                name="memorytype",
                native_enum=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source_call_id", sa.Uuid(), nullable=True),
        sa.Column("importance", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_call_id"],
            ["calls.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # Create index on user_id for fast lookups
    op.create_index(
        op.f("ix_conversation_memories_user_id"),
        "conversation_memories",
        ["user_id"],
        unique=False,
    )
    # Create index on source_call_id for fast lookups
    op.create_index(
        op.f("ix_conversation_memories_source_call_id"),
        "conversation_memories",
        ["source_call_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop conversation_memories table."""
    op.drop_index(
        op.f("ix_conversation_memories_source_call_id"),
        table_name="conversation_memories",
    )
    op.drop_index(
        op.f("ix_conversation_memories_user_id"),
        table_name="conversation_memories",
    )
    op.drop_table("conversation_memories")
