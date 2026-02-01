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
    # Create intervention_status enum type (if not exists)
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interventionstatus') THEN
                CREATE TYPE interventionstatus AS ENUM (
                    'planned',
                    'active',
                    'completed',
                    'cancelled'
                );
            END IF;
        END$$;
        """
    )

    # Create the table using raw SQL to avoid SQLAlchemy trying to create the enum
    op.execute(
        """
        CREATE TABLE interventions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            hypothesis TEXT,
            nutrient_key VARCHAR(100),
            target_value FLOAT,
            start_date DATE NOT NULL,
            end_date DATE,
            status interventionstatus NOT NULL DEFAULT 'planned',
            outcome_notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
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
