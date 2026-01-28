"""Schedule CRUD endpoints."""

from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import ScheduleCreate, ScheduleRead, ScheduleUpdate
from src.database import get_db
from src.models import Schedule, User

logger = structlog.get_logger()

router = APIRouter()


@router.get("/", response_model=list[ScheduleRead])
async def list_schedules(
    user_id: UUID | None = Query(default=None, description="Filter by user ID"),
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        default=100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    db: AsyncSession = Depends(get_db),
) -> list[Schedule]:
    """List all schedules with optional user_id filter and pagination.

    Args:
        user_id: Optional UUID to filter schedules by user.
        skip: Number of records to skip (offset).
        limit: Maximum number of records to return.
        db: Database session.

    Returns:
        List of schedules.
    """
    logger.info(
        "Listing schedules", user_id=str(user_id) if user_id else None, skip=skip, limit=limit
    )

    query = select(Schedule).order_by(Schedule.created_at.desc())

    if user_id is not None:
        query = query.where(Schedule.user_id == user_id)

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    schedules = result.scalars().all()

    logger.info("Schedules retrieved", count=len(schedules))
    return list(schedules)


@router.get("/{schedule_id}", response_model=ScheduleRead)
async def get_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> Schedule:
    """Get a schedule by ID.

    Args:
        schedule_id: UUID of the schedule to retrieve.
        db: Database session.

    Returns:
        The requested schedule.

    Raises:
        HTTPException: 404 if schedule not found.
    """
    logger.info("Getting schedule", schedule_id=str(schedule_id))

    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()

    if schedule is None:
        logger.warning("Schedule not found", schedule_id=str(schedule_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule with id {schedule_id} not found",
        )

    logger.info("Schedule retrieved", schedule_id=str(schedule_id))
    return schedule


@router.post("/", response_model=ScheduleRead, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    schedule_data: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
) -> Schedule:
    """Create a new schedule.

    Args:
        schedule_data: Schedule creation data.
        db: Database session.

    Returns:
        The created schedule.

    Raises:
        HTTPException: 404 if user not found.
    """
    logger.info("Creating schedule", user_id=str(schedule_data.user_id))

    # Verify user exists
    result = await db.execute(select(User).where(User.id == schedule_data.user_id))
    user = result.scalar_one_or_none()

    if user is None:
        logger.warning("User not found for schedule creation", user_id=str(schedule_data.user_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {schedule_data.user_id} not found",
        )

    schedule = Schedule(
        user_id=schedule_data.user_id,
        cron_expression=schedule_data.cron_expression,
        enabled=schedule_data.enabled,
    )

    db.add(schedule)

    try:
        await db.flush()
        await db.refresh(schedule)
    except IntegrityError as e:
        await db.rollback()
        logger.error("Integrity error creating schedule", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create schedule due to database constraint violation",
        ) from e

    logger.info(
        "Schedule created",
        schedule_id=str(schedule.id),
        user_id=str(schedule.user_id),
    )
    return schedule


@router.patch("/{schedule_id}", response_model=ScheduleRead)
async def update_schedule(
    schedule_id: UUID,
    schedule_data: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
) -> Schedule:
    """Update a schedule (partial update).

    Args:
        schedule_id: UUID of the schedule to update.
        schedule_data: Schedule update data (only provided fields will be updated).
        db: Database session.

    Returns:
        The updated schedule.

    Raises:
        HTTPException: 404 if schedule not found.
    """
    logger.info("Updating schedule", schedule_id=str(schedule_id))

    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()

    if schedule is None:
        logger.warning("Schedule not found for update", schedule_id=str(schedule_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule with id {schedule_id} not found",
        )

    # Only update fields that were explicitly provided
    update_data = schedule_data.model_dump(exclude_unset=True)

    if not update_data:
        logger.info("No fields to update", schedule_id=str(schedule_id))
        return schedule

    for field, value in update_data.items():
        setattr(schedule, field, value)

    await db.flush()
    await db.refresh(schedule)

    logger.info(
        "Schedule updated",
        schedule_id=str(schedule_id),
        updated_fields=list(update_data.keys()),
    )
    return schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a schedule.

    Args:
        schedule_id: UUID of the schedule to delete.
        db: Database session.

    Raises:
        HTTPException: 404 if schedule not found.
    """
    logger.info("Deleting schedule", schedule_id=str(schedule_id))

    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()

    if schedule is None:
        logger.warning("Schedule not found for deletion", schedule_id=str(schedule_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule with id {schedule_id} not found",
        )

    await db.delete(schedule)
    await db.flush()

    logger.info("Schedule deleted", schedule_id=str(schedule_id))
