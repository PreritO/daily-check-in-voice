"""Add direction column to calls table.

Revision ID: 006_direction
Revises: 005_mood
Create Date: 2026-01-30

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "006_direction"
down_revision: str | Sequence[str] | None = "005_mood"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add direction column to calls table."""
    op.add_column(
        "calls",
        sa.Column(
            "direction",
            sa.Enum(
                "inbound",
                "outbound",
                name="calldirection",
                native_enum=False,
                length=20,
            ),
            server_default="outbound",
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Remove direction column from calls table."""
    op.drop_column("calls", "direction")
