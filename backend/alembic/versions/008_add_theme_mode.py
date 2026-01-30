"""Add theme_mode column to user_preferences.

Revision ID: 008_theme_mode
Revises: 007_alerts
Create Date: 2026-01-30

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "008_theme_mode"
down_revision: str | None = "007_alerts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add theme_mode column to user_preferences table."""
    op.add_column(
        "user_preferences",
        sa.Column(
            "theme_mode",
            sa.String(length=10),
            server_default="system",
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Remove theme_mode column from user_preferences table."""
    op.drop_column("user_preferences", "theme_mode")
