"""Call CRUD endpoints."""

from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.schemas import CallCreate, CallRead, CallReadWithDetails, CallUpdate
from src.database import get_db
from src.models import Call, User

logger = structlog.get_logger()

router = APIRouter()


@router.get("/", response_model=list[CallRead])
async def list_calls(
    user_id: UUID | None = Query(default=None, description="Filter by user ID"),
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        default=100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    db: AsyncSession = Depends(get_db),
) -> list[Call]:
    """List all calls with optional user_id filter and pagination.

    Args:
        user_id: Optional UUID to filter calls by user.
        skip: Number of records to skip (offset).
        limit: Maximum number of records to return.
        db: Database session.

    Returns:
        List of calls.
    """
    logger.info("Listing calls", user_id=str(user_id) if user_id else None, skip=skip, limit=limit)

    query = select(Call).order_by(Call.created_at.desc())

    if user_id is not None:
        query = query.where(Call.user_id == user_id)

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    calls = result.scalars().all()

    logger.info("Calls retrieved", count=len(calls))
    return list(calls)


@router.get("/{call_id}", response_model=CallReadWithDetails)
async def get_call(
    call_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> Call:
    """Get a call by ID with transcripts and summary.

    Args:
        call_id: UUID of the call to retrieve.
        db: Database session.

    Returns:
        The requested call with nested transcripts and summary.

    Raises:
        HTTPException: 404 if call not found.
    """
    logger.info("Getting call", call_id=str(call_id))

    result = await db.execute(
        select(Call)
        .where(Call.id == call_id)
        .options(
            selectinload(Call.transcripts),
            selectinload(Call.summary),
        )
    )
    call = result.scalar_one_or_none()

    if call is None:
        logger.warning("Call not found", call_id=str(call_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Call with id {call_id} not found",
        )

    logger.info("Call retrieved", call_id=str(call_id))
    return call


@router.post("/", response_model=CallRead, status_code=status.HTTP_201_CREATED)
async def create_call(
    call_data: CallCreate,
    db: AsyncSession = Depends(get_db),
) -> Call:
    """Create a new call.

    Args:
        call_data: Call creation data.
        db: Database session.

    Returns:
        The created call.

    Raises:
        HTTPException: 404 if user not found.
    """
    logger.info("Creating call", user_id=str(call_data.user_id))

    # Verify user exists
    result = await db.execute(select(User).where(User.id == call_data.user_id))
    user = result.scalar_one_or_none()

    if user is None:
        logger.warning("User not found for call creation", user_id=str(call_data.user_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {call_data.user_id} not found",
        )

    call = Call(
        user_id=call_data.user_id,
        status=call_data.status,
        scheduled_at=call_data.scheduled_at,
    )

    db.add(call)

    try:
        await db.flush()
        await db.refresh(call)
    except IntegrityError as e:
        await db.rollback()
        logger.error("Integrity error creating call", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create call due to database constraint violation",
        ) from e

    logger.info("Call created", call_id=str(call.id), user_id=str(call.user_id))
    return call


@router.patch("/{call_id}", response_model=CallRead)
async def update_call(
    call_id: UUID,
    call_data: CallUpdate,
    db: AsyncSession = Depends(get_db),
) -> Call:
    """Update a call (partial update).

    Args:
        call_id: UUID of the call to update.
        call_data: Call update data (only provided fields will be updated).
        db: Database session.

    Returns:
        The updated call.

    Raises:
        HTTPException: 404 if call not found.
    """
    logger.info("Updating call", call_id=str(call_id))

    result = await db.execute(select(Call).where(Call.id == call_id))
    call = result.scalar_one_or_none()

    if call is None:
        logger.warning("Call not found for update", call_id=str(call_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Call with id {call_id} not found",
        )

    # Only update fields that were explicitly provided
    update_data = call_data.model_dump(exclude_unset=True)

    if not update_data:
        logger.info("No fields to update", call_id=str(call_id))
        return call

    for field, value in update_data.items():
        setattr(call, field, value)

    await db.flush()
    await db.refresh(call)

    logger.info("Call updated", call_id=str(call_id), updated_fields=list(update_data.keys()))
    return call


@router.delete("/{call_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_call(
    call_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a call.

    Args:
        call_id: UUID of the call to delete.
        db: Database session.

    Raises:
        HTTPException: 404 if call not found.
    """
    logger.info("Deleting call", call_id=str(call_id))

    result = await db.execute(select(Call).where(Call.id == call_id))
    call = result.scalar_one_or_none()

    if call is None:
        logger.warning("Call not found for deletion", call_id=str(call_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Call with id {call_id} not found",
        )

    await db.delete(call)
    await db.flush()

    logger.info("Call deleted", call_id=str(call_id))
