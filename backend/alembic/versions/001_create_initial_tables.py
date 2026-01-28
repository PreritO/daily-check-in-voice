"""Create initial database tables.

Revision ID: 001_initial
Revises:
Create Date: 2026-01-28

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create all initial tables."""
    # Create users table
    op.create_table(
        "users",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("timezone", sa.String(50), server_default="UTC", nullable=False),
        sa.Column("phone_number", sa.String(20), nullable=True),
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
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # Create calls table
    op.create_table(
        "calls",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "scheduled",
                "in_progress",
                "completed",
                "failed",
                name="callstatus",
                native_enum=False,
                length=20,
            ),
            nullable=False,
            server_default="scheduled",
        ),
        sa.Column("scheduled_at", sa.DateTime(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_calls_user_id"), "calls", ["user_id"], unique=False)

    # Create transcripts table
    op.create_table(
        "transcripts",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("call_id", sa.Uuid(), nullable=False),
        sa.Column(
            "speaker",
            sa.Enum(
                "agent",
                "user",
                name="speaker",
                native_enum=False,
                length=10,
            ),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("timestamp_ms", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["call_id"], ["calls.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_transcripts_call_id"), "transcripts", ["call_id"], unique=False)

    # Create summaries table
    op.create_table(
        "summaries",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("call_id", sa.Uuid(), nullable=False),
        sa.Column("yesterday", sa.Text(), nullable=False),
        sa.Column("today", sa.Text(), nullable=False),
        sa.Column("blockers", sa.Text(), nullable=True),
        sa.Column("raw_summary", sa.Text(), nullable=False),
        sa.Column("posted_to_slack", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("slack_message_id", sa.String(50), nullable=True),
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
        sa.ForeignKeyConstraint(["call_id"], ["calls.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("call_id"),
    )
    op.create_index(op.f("ix_summaries_call_id"), "summaries", ["call_id"], unique=True)

    # Create schedules table
    op.create_table(
        "schedules",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("cron_expression", sa.String(100), nullable=False),
        sa.Column("next_run_at", sa.DateTime(), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_schedules_user_id"), "schedules", ["user_id"], unique=False)


def downgrade() -> None:
    """Drop all tables in reverse order."""
    op.drop_index(op.f("ix_schedules_user_id"), table_name="schedules")
    op.drop_table("schedules")

    op.drop_index(op.f("ix_summaries_call_id"), table_name="summaries")
    op.drop_table("summaries")

    op.drop_index(op.f("ix_transcripts_call_id"), table_name="transcripts")
    op.drop_table("transcripts")

    op.drop_index(op.f("ix_calls_user_id"), table_name="calls")
    op.drop_table("calls")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
