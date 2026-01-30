"""Fix enum values to use lowercase.

Revision ID: 009_fix_enums
Revises: 008_theme_mode
Create Date: 2026-01-30

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "009_fix_enums"
down_revision: str | None = "008_theme_mode"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Convert enum values from uppercase to lowercase."""
    # Fix communication_style
    op.execute(
        """
        UPDATE user_preferences
        SET communication_style = LOWER(communication_style)
        WHERE communication_style IN ('CASUAL', 'FORMAL', 'FRIENDLY')
        """
    )

    # Fix call_duration_preference
    op.execute(
        """
        UPDATE user_preferences
        SET call_duration_preference = LOWER(call_duration_preference)
        WHERE call_duration_preference IN ('SHORT', 'MEDIUM', 'LONG')
        """
    )

    # Fix theme_mode (in case any were stored uppercase)
    op.execute(
        """
        UPDATE user_preferences
        SET theme_mode = LOWER(theme_mode)
        WHERE theme_mode IN ('LIGHT', 'DARK', 'SYSTEM')
        """
    )


def downgrade() -> None:
    """Convert enum values back to uppercase."""
    # Fix communication_style
    op.execute(
        """
        UPDATE user_preferences
        SET communication_style = UPPER(communication_style)
        WHERE communication_style IN ('casual', 'formal', 'friendly')
        """
    )

    # Fix call_duration_preference
    op.execute(
        """
        UPDATE user_preferences
        SET call_duration_preference = UPPER(call_duration_preference)
        WHERE call_duration_preference IN ('short', 'medium', 'long')
        """
    )

    # Fix theme_mode
    op.execute(
        """
        UPDATE user_preferences
        SET theme_mode = UPPER(theme_mode)
        WHERE theme_mode IN ('light', 'dark', 'system')
        """
    )
