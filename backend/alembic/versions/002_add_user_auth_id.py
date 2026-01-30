"""Add auth_id column to users table.

Revision ID: 002_auth_id
Revises: 001_initial
Create Date: 2026-01-29

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_auth_id"
down_revision: str | Sequence[str] | None = "001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add auth_id column to users table for Supabase Auth integration."""
    op.add_column(
        "users",
        sa.Column("auth_id", sa.String(36), nullable=True),
    )
    op.create_index(op.f("ix_users_auth_id"), "users", ["auth_id"], unique=True)


def downgrade() -> None:
    """Remove auth_id column from users table."""
    op.drop_index(op.f("ix_users_auth_id"), table_name="users")
    op.drop_column("users", "auth_id")
