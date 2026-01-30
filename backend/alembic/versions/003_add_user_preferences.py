"""Add user_preferences table.

Revision ID: 003_preferences
Revises: 002_auth_id
Create Date: 2026-01-29

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003_preferences"
down_revision: str | Sequence[str] | None = "002_auth_id"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create user_preferences table."""
    op.create_table(
        "user_preferences",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "conversation_topics",
            sa.JSON(),
            server_default="[]",
            nullable=False,
        ),
        sa.Column(
            "interests",
            sa.JSON(),
            server_default="[]",
            nullable=False,
        ),
        sa.Column(
            "communication_style",
            sa.Enum(
                "casual",
                "formal",
                "friendly",
                name="communicationstyle",
                native_enum=False,
                length=20,
            ),
            server_default="friendly",
            nullable=False,
        ),
        sa.Column(
            "call_duration_preference",
            sa.Enum(
                "short",
                "medium",
                "long",
                name="calldurationpreference",
                native_enum=False,
                length=20,
            ),
            server_default="medium",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # Create unique index on user_id (also serves as constraint)
    op.create_index(
        op.f("ix_user_preferences_user_id"),
        "user_preferences",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    """Drop user_preferences table."""
    op.drop_index(
        op.f("ix_user_preferences_user_id"),
        table_name="user_preferences",
    )
    op.drop_table("user_preferences")
