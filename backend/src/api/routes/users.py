"""User CRUD endpoints."""

from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import UserCreate, UserRead, UserUpdate
from src.database import get_db
from src.models import User

logger = structlog.get_logger()

router = APIRouter()


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
