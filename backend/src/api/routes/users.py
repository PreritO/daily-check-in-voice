"""User CRUD endpoints."""

from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_or_create_user
from src.api.schemas import MoodTrendItemRead, UserAnalyticsRead, UserCreate, UserRead, UserUpdate
from src.database import get_db
from src.models import User
from src.services.analytics_service import get_user_analytics

logger = structlog.get_logger()

router = APIRouter()


@router.get("/me", response_model=UserRead)
async def get_current_user_profile(
    current_user: User = Depends(get_or_create_user),
) -> User:
    """Get the current authenticated user's profile.

    This endpoint uses get_or_create_user dependency which will:
    - Create a new user record if this is the first time they're calling the API
    - Return the existing user record if they already exist

    Args:
        current_user: The authenticated user from the JWT token.

    Returns:
        The current user's profile.
    """
    logger.info("Getting current user profile", user_id=str(current_user.id))
    return current_user


@router.patch("/me", response_model=UserRead)
async def update_current_user_profile(
    user_data: UserUpdate,
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Update the current authenticated user's profile.

    Uses get_or_create_user to support the onboarding flow where
    this may be the first API call after Supabase signup.

    Args:
        user_data: User update data (only provided fields will be updated).
        current_user: The authenticated user from the JWT token.
        db: Database session.

    Returns:
        The updated user profile.

    Raises:
        HTTPException: 409 if email already exists.
    """
    logger.info("Updating current user profile", user_id=str(current_user.id))

    # Only update fields that were explicitly provided
    update_data = user_data.model_dump(exclude_unset=True)

    if not update_data:
        logger.info("No fields to update", user_id=str(current_user.id))
        return current_user

    for field, value in update_data.items():
        setattr(current_user, field, value)

    try:
        await db.flush()
        await db.refresh(current_user)
    except IntegrityError as e:
        await db.rollback()
        logger.warning("Duplicate email on update", user_id=str(current_user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email {update_data.get('email')} already exists",
        ) from e

    logger.info(
        "Current user profile updated",
        user_id=str(current_user.id),
        updated_fields=list(update_data.keys()),
    )
    return current_user


@router.get("/me/analytics", response_model=UserAnalyticsRead)
async def get_current_user_analytics(
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> UserAnalyticsRead:
    """Get analytics for the current authenticated user.

    Returns aggregated statistics about the user's call history including:
    - Total calls and duration
    - Calls this week and month
    - Mood trend data points
    - Current streak of consecutive days with calls

    Args:
        current_user: The authenticated user from the JWT token.
        db: Database session.

    Returns:
        UserAnalyticsRead with all computed analytics metrics.
    """
    logger.info("Getting current user analytics", user_id=str(current_user.id))

    analytics = await get_user_analytics(
        user_id=current_user.id,
        db=db,
        user_timezone=current_user.timezone,
    )

    # Convert dataclass to Pydantic
    return UserAnalyticsRead(
        total_calls=analytics.total_calls,
        total_duration_minutes=analytics.total_duration_minutes,
        average_call_duration=analytics.average_call_duration,
        calls_this_week=analytics.calls_this_week,
        calls_this_month=analytics.calls_this_month,
        mood_trend=[
            MoodTrendItemRead(
                call_date=item.call_date,
                sentiment=item.sentiment,
                confidence=item.confidence,
            )
            for item in analytics.mood_trend
        ],
        streak_days=analytics.streak_days,
    )


@router.get("/", response_model=list[UserRead])
async def list_users(
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        default=100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    db: AsyncSession = Depends(get_db),
) -> list[User]:
    """List all users with pagination.

    Args:
        skip: Number of records to skip (offset).
        limit: Maximum number of records to return.
        db: Database session.

    Returns:
        List of users.
    """
    logger.info("Listing users", skip=skip, limit=limit)

    result = await db.execute(
        select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    users = result.scalars().all()

    logger.info("Users retrieved", count=len(users))
    return list(users)


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get a user by ID.

    Args:
        user_id: UUID of the user to retrieve.
        db: Database session.

    Returns:
        The requested user.

    Raises:
        HTTPException: 404 if user not found.
    """
    logger.info("Getting user", user_id=str(user_id))

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        logger.warning("User not found", user_id=str(user_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found",
        )

    logger.info("User retrieved", user_id=str(user_id))
    return user


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Create a new user.

    Args:
        user_data: User creation data.
        db: Database session.

    Returns:
        The created user.

    Raises:
        HTTPException: 409 if email already exists.
    """
    logger.info("Creating user")

    user = User(
        email=user_data.email,
        name=user_data.name,
        timezone=user_data.timezone,
        phone_number=user_data.phone_number,
    )

    db.add(user)

    try:
        await db.flush()
        await db.refresh(user)
    except IntegrityError as e:
        await db.rollback()
        logger.warning("Duplicate email attempted", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email {user_data.email} already exists",
        ) from e

    logger.info("User created", user_id=str(user.id))
    return user


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Update a user (partial update).

    Args:
        user_id: UUID of the user to update.
        user_data: User update data (only provided fields will be updated).
        db: Database session.

    Returns:
        The updated user.

    Raises:
        HTTPException: 404 if user not found, 409 if email already exists.
    """
    logger.info("Updating user", user_id=str(user_id))

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        logger.warning("User not found for update", user_id=str(user_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found",
        )

    # Only update fields that were explicitly provided
    update_data = user_data.model_dump(exclude_unset=True)

    if not update_data:
        logger.info("No fields to update", user_id=str(user_id))
        return user

    for field, value in update_data.items():
        setattr(user, field, value)

    try:
        await db.flush()
        await db.refresh(user)
    except IntegrityError as e:
        await db.rollback()
        logger.warning("Duplicate email on update", user_id=str(user_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email {update_data.get('email')} already exists",
        ) from e

    logger.info("User updated", user_id=str(user_id), updated_fields=list(update_data.keys()))
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a user.

    Args:
        user_id: UUID of the user to delete.
        db: Database session.

    Raises:
        HTTPException: 404 if user not found.
    """
    logger.info("Deleting user", user_id=str(user_id))

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        logger.warning("User not found for deletion", user_id=str(user_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found",
        )

    await db.delete(user)
    await db.flush()

    logger.info("User deleted", user_id=str(user_id))
