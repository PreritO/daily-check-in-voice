"""Convert all timestamp columns to TIMESTAMP WITH TIME ZONE.

Revision ID: 011
Revises: 010
Create Date: 2026-01-31

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "011_timestamptz"
down_revision: str | None = "010_cronometer"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# All datetime columns that need to be converted to TIMESTAMPTZ
TIMESTAMP_COLUMNS = [
    # users table
    ("users", "created_at"),
    ("users", "updated_at"),
    # calls table
    ("calls", "scheduled_at"),
    ("calls", "started_at"),
    ("calls", "ended_at"),
    ("calls", "created_at"),
    ("calls", "updated_at"),
    # schedules table
    ("schedules", "next_run_at"),
    ("schedules", "created_at"),
    ("schedules", "updated_at"),
    # transcripts table
    ("transcripts", "created_at"),
    # summaries table
    ("summaries", "created_at"),
    ("summaries", "updated_at"),
    # user_preferences table
    ("user_preferences", "created_at"),
    ("user_preferences", "updated_at"),
    # conversation_memories table
    ("conversation_memories", "created_at"),
    # mood_analyses table
    ("mood_analyses", "analyzed_at"),
    # alerts table
    ("alerts", "acknowledged_at"),
    ("alerts", "created_at"),
    # cronometer_credentials table
    ("cronometer_credentials", "last_sync_at"),
    ("cronometer_credentials", "created_at"),
    ("cronometer_credentials", "updated_at"),
    # food_logs table
    ("food_logs", "logged_at"),
    ("food_logs", "created_at"),
    # biometric_logs table
    ("biometric_logs", "logged_at"),
    ("biometric_logs", "created_at"),
    # health_notes table
    ("health_notes", "logged_at"),
    ("health_notes", "created_at"),
]


def upgrade() -> None:
    """Convert all timestamp columns to TIMESTAMP WITH TIME ZONE."""
    for table, column in TIMESTAMP_COLUMNS:
        # PostgreSQL allows altering column type with USING clause
        # This converts existing timestamps to timestamptz (assumes they're in UTC)
        op.execute(
            f"""
            ALTER TABLE {table}
            ALTER COLUMN {column}
            TYPE TIMESTAMP WITH TIME ZONE
            USING {column} AT TIME ZONE 'UTC'
            """
        )


def downgrade() -> None:
    """Revert timestamp columns back to TIMESTAMP WITHOUT TIME ZONE."""
    for table, column in TIMESTAMP_COLUMNS:
        op.execute(
            f"""
            ALTER TABLE {table}
            ALTER COLUMN {column}
            TYPE TIMESTAMP WITHOUT TIME ZONE
            """
        )
