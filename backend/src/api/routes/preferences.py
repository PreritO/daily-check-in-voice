"""User preferences CRUD endpoints."""

import structlog
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_or_create_user
from src.api.schemas import PreferencesRead, PreferencesUpsert
from src.database import get_db
from src.models import User
from src.models.preferences import (
    CallDurationPreference,
    CommunicationStyle,
    UserPreferences,
)

logger = structlog.get_logger()

router = APIRouter()


@router.get("", response_model=PreferencesRead)
async def get_preferences(
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> UserPreferences:
    """Get current user's preferences. Creates default preferences if none exist.

    Args:
        current_user: The authenticated user from the JWT token.
        db: Database session.

    Returns:
        The user's preferences (creates defaults if none exist).
    """
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    preferences = result.scalar_one_or_none()

    if preferences is None:
        # Create default preferences with explicit enum values (SQLite compatibility)
        preferences = UserPreferences(
            user_id=current_user.id,
            conversation_topics=[],
            interests=[],
            communication_style=CommunicationStyle.FRIENDLY,
            call_duration_preference=CallDurationPreference.MEDIUM,
        )
        db.add(preferences)
        try:
            await db.flush()
            logger.info("Created default preferences", user_id=str(current_user.id))
        except IntegrityError:
            # Race condition: another request created preferences - fetch it
            await db.rollback()
            result = await db.execute(
                select(UserPreferences).where(UserPreferences.user_id == current_user.id)
            )
            preferences = result.scalar_one()
            logger.debug(
                "Retrieved preferences (concurrent create)",
                user_id=str(current_user.id),
            )
        else:
            await db.refresh(preferences)
    else:
        logger.debug("Retrieved existing preferences", user_id=str(current_user.id))

    return preferences


@router.put("", response_model=PreferencesRead)
async def upsert_preferences(
    preferences_data: PreferencesUpsert,
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> UserPreferences:
    """Create or update current user's preferences.

    Args:
        preferences_data: Preferences data to upsert (only provided fields will be updated).
        current_user: The authenticated user from the JWT token.
        db: Database session.

    Returns:
        The created or updated preferences.
    """
    # Get update data (excluding None values)
    update_data = preferences_data.model_dump(exclude_unset=True)

    # Select existing preferences
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    preferences = result.scalar_one_or_none()

    if preferences is None:
        # Create new preferences
        preferences = UserPreferences(user_id=current_user.id, **update_data)
        db.add(preferences)
        try:
            await db.flush()
            logger.info("Created user preferences", user_id=str(current_user.id))
        except IntegrityError:
            # Race condition: another request created preferences - fetch and update
            await db.rollback()
            result = await db.execute(
                select(UserPreferences).where(UserPreferences.user_id == current_user.id)
            )
            preferences = result.scalar_one()
            for field, value in update_data.items():
                setattr(preferences, field, value)
            await db.flush()
            logger.info(
                "Updated user preferences (concurrent create)",
                user_id=str(current_user.id),
            )
    else:
        # Update existing preferences
        for field, value in update_data.items():
            setattr(preferences, field, value)
        await db.flush()
        logger.info("Updated user preferences", user_id=str(current_user.id))

    await db.refresh(preferences)
    return preferences


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_preferences(
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete current user's preferences (reset to defaults).

    Args:
        current_user: The authenticated user from the JWT token.
        db: Database session.
    """
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    preferences = result.scalar_one_or_none()

    if preferences:
        await db.delete(preferences)
        await db.flush()
        logger.info("Deleted user preferences", user_id=str(current_user.id))
