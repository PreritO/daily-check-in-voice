"""Add exercise_logs table for Cronometer exercise data.

Revision ID: 013_exercise_logs
Revises: 012_interventions
Create Date: 2026-02-01

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "013_exercise_logs"
down_revision: str | None = "012_interventions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create exercise_logs table."""
    op.create_table(
        "exercise_logs",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("logged_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("duration_minutes", sa.Float(), nullable=True),
        sa.Column("calories_burned", sa.Float(), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("cronometer_hash", sa.String(64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(op.f("ix_exercise_logs_user_id"), "exercise_logs", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_exercise_logs_logged_at"), "exercise_logs", ["logged_at"], unique=False
    )
    op.create_index(
        op.f("ix_exercise_logs_cronometer_hash"),
        "exercise_logs",
        ["cronometer_hash"],
        unique=True,
    )


def downgrade() -> None:
    """Drop exercise_logs table."""
    op.drop_index(op.f("ix_exercise_logs_cronometer_hash"), table_name="exercise_logs")
    op.drop_index(op.f("ix_exercise_logs_logged_at"), table_name="exercise_logs")
    op.drop_index(op.f("ix_exercise_logs_user_id"), table_name="exercise_logs")
    op.drop_table("exercise_logs")
