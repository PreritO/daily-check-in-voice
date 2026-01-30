"""Add mood_analyses table.

Revision ID: 005_mood
Revises: 004_memory
Create Date: 2026-01-30

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "005_mood"
down_revision: str | Sequence[str] | None = "004_memory"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create mood_analyses table."""
    op.create_table(
        "mood_analyses",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("call_id", sa.Uuid(), nullable=False),
        sa.Column(
            "overall_sentiment",
            sa.Enum(
                "positive",
                "neutral",
                "negative",
                "concerned",
                name="sentimenttype",
                native_enum=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("flags", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "analyzed_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["call_id"],
            ["calls.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # Create unique index on call_id for one-to-one relationship
    op.create_index(
        op.f("ix_mood_analyses_call_id"),
        "mood_analyses",
        ["call_id"],
        unique=True,
    )


def downgrade() -> None:
    """Drop mood_analyses table."""
    op.drop_index(
        op.f("ix_mood_analyses_call_id"),
        table_name="mood_analyses",
    )
    op.drop_table("mood_analyses")
