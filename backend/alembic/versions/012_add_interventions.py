"""Add interventions table for dietary experiments.

Revision ID: 012
Revises: 011
Create Date: 2026-01-31

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "012_interventions"
down_revision: str | None = "011_timestamptz"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create interventions table."""
    # Create intervention_status enum type
    op.execute(
        """
        CREATE TYPE interventionstatus AS ENUM (
            'planned',
            'active',
            'completed',
            'cancelled'
        )
        """
    )

    op.create_table(
        "interventions",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("hypothesis", sa.Text(), nullable=True),
        sa.Column("nutrient_key", sa.String(100), nullable=True),
        sa.Column("target_value", sa.Float(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "planned",
                "active",
                "completed",
                "cancelled",
                name="interventionstatus",
                create_type=False,
            ),
            server_default="planned",
            nullable=False,
        ),
        sa.Column("outcome_notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
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

    # Create index on user_id for faster lookups
    op.create_index(
        "ix_interventions_user_id",
        "interventions",
        ["user_id"],
    )


def downgrade() -> None:
    """Drop interventions table."""
    op.drop_index("ix_interventions_user_id", table_name="interventions")
    op.drop_table("interventions")
    op.execute("DROP TYPE interventionstatus")
