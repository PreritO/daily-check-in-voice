"""Add Cronometer integration tables.

Revision ID: 010_cronometer
Revises: 009_fix_enums
Create Date: 2026-01-30

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "010_cronometer"
down_revision: str | None = "009_fix_enums"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create Cronometer integration tables."""
    # cronometer_credentials table
    op.create_table(
        "cronometer_credentials",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("encrypted_email", sa.Text(), nullable=False),
        sa.Column("encrypted_password", sa.Text(), nullable=False),
        sa.Column("last_sync_at", sa.DateTime(), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("user_id"),
    )

    # food_logs table
    op.create_table(
        "food_logs",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("logged_at", sa.DateTime(), nullable=False),
        sa.Column("food_name", sa.String(255), nullable=False),
        sa.Column("serving_size", sa.String(100), nullable=False),
        sa.Column("food_group", sa.String(100), nullable=True),
        sa.Column("calories", sa.Float(), nullable=True),
        sa.Column("protein_g", sa.Float(), nullable=True),
        sa.Column("carbs_g", sa.Float(), nullable=True),
        sa.Column("fat_g", sa.Float(), nullable=True),
        sa.Column("fiber_g", sa.Float(), nullable=True),
        sa.Column("sugar_g", sa.Float(), nullable=True),
        sa.Column("sodium_mg", sa.Float(), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("cronometer_hash", sa.String(64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
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
    op.create_index(op.f("ix_food_logs_user_id"), "food_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_food_logs_logged_at"), "food_logs", ["logged_at"], unique=False)
    op.create_index(
        op.f("ix_food_logs_cronometer_hash"), "food_logs", ["cronometer_hash"], unique=True
    )

    # biometric_logs table
    op.create_table(
        "biometric_logs",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("logged_at", sa.DateTime(), nullable=False),
        sa.Column("metric_type", sa.String(50), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("cronometer_hash", sa.String(64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
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
    op.create_index(op.f("ix_biometric_logs_user_id"), "biometric_logs", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_biometric_logs_logged_at"), "biometric_logs", ["logged_at"], unique=False
    )
    op.create_index(
        op.f("ix_biometric_logs_cronometer_hash"),
        "biometric_logs",
        ["cronometer_hash"],
        unique=True,
    )

    # health_notes table
    op.create_table(
        "health_notes",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("logged_at", sa.DateTime(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_bowel_movement", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("bristol_scale", sa.Integer(), nullable=True),
        sa.Column("quantity_score", sa.Integer(), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("cronometer_hash", sa.String(64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
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
    op.create_index(op.f("ix_health_notes_user_id"), "health_notes", ["user_id"], unique=False)
    op.create_index(op.f("ix_health_notes_logged_at"), "health_notes", ["logged_at"], unique=False)
    op.create_index(
        op.f("ix_health_notes_cronometer_hash"),
        "health_notes",
        ["cronometer_hash"],
        unique=True,
    )


def downgrade() -> None:
    """Drop Cronometer integration tables."""
    # Drop health_notes
    op.drop_index(op.f("ix_health_notes_cronometer_hash"), table_name="health_notes")
    op.drop_index(op.f("ix_health_notes_logged_at"), table_name="health_notes")
    op.drop_index(op.f("ix_health_notes_user_id"), table_name="health_notes")
    op.drop_table("health_notes")

    # Drop biometric_logs
    op.drop_index(op.f("ix_biometric_logs_cronometer_hash"), table_name="biometric_logs")
    op.drop_index(op.f("ix_biometric_logs_logged_at"), table_name="biometric_logs")
    op.drop_index(op.f("ix_biometric_logs_user_id"), table_name="biometric_logs")
    op.drop_table("biometric_logs")

    # Drop food_logs
    op.drop_index(op.f("ix_food_logs_cronometer_hash"), table_name="food_logs")
    op.drop_index(op.f("ix_food_logs_logged_at"), table_name="food_logs")
    op.drop_index(op.f("ix_food_logs_user_id"), table_name="food_logs")
    op.drop_table("food_logs")

    # Drop cronometer_credentials
    op.drop_table("cronometer_credentials")
