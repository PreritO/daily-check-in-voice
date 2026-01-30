"""Call CRUD endpoints."""

from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.schemas import (
    CallCreate,
    CallRead,
    CallReadWithDetails,
    CallTriggerRequest,
    CallTriggerResponse,
    CallUpdate,
    MemoryRead,
    MoodAnalysisRead,
    SummaryRead,
)
from src.database import get_db
from src.models import (
    Call,
    CallDirection,
    CallStatus,
    ConversationMemory,
    MoodAnalysis,
    Summary,
    User,
)
from src.services import (
    analyze_mood,
    create_room_for_call,
    dispatch_agent_to_room,
    extract_memories,
    generate_summary,
)

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
            selectinload(Call.mood_analysis),
            selectinload(Call.memories),
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


@router.post(
    "/{call_id}/summarize", response_model=SummaryRead, status_code=status.HTTP_201_CREATED
)
async def summarize_call(
    call_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> Summary:
    """Generate a summary for a call from its transcripts.

    Args:
        call_id: UUID of the call to summarize.
        db: Database session.

    Returns:
        The generated summary.

    Raises:
        HTTPException: 404 if call not found, 400 if no transcripts, 409 if summary exists.
    """
    logger.info("Generating summary for call", call_id=str(call_id))

    # Get call with transcripts and summary
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
        logger.warning("Call not found for summarization", call_id=str(call_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Call with id {call_id} not found",
        )

    # Check if transcripts exist
    if not call.transcripts:
        logger.warning("No transcripts for call", call_id=str(call_id))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot generate summary: call has no transcripts",
        )

    # Check if summary already exists
    if call.summary is not None:
        logger.warning("Summary already exists for call", call_id=str(call_id))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Summary already exists for this call",
        )

    # Generate summary using Anthropic Claude
    try:
        standup_summary = await generate_summary(call.transcripts)
    except ValueError as e:
        logger.error("Summary generation failed", call_id=str(call_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate summary: {e}",
        ) from e

    # Create and save summary to database
    summary = Summary(
        call_id=call_id,
        yesterday=standup_summary.yesterday,
        today=standup_summary.today,
        blockers=standup_summary.blockers,
        raw_summary=standup_summary.raw_summary,
    )

    db.add(summary)
    await db.flush()
    await db.refresh(summary)

    logger.info("Summary generated and saved", call_id=str(call_id), summary_id=str(summary.id))
    return summary


@router.post(
    "/{call_id}/analyze-mood", response_model=MoodAnalysisRead, status_code=status.HTTP_201_CREATED
)
async def analyze_call_mood(
    call_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> MoodAnalysis:
    """Analyze mood from a call's transcripts.

    Args:
        call_id: UUID of the call to analyze.
        db: Database session.

    Returns:
        The generated mood analysis.

    Raises:
        HTTPException: 404 if call not found, 400 if no transcripts, 409 if mood_analysis exists.
    """
    logger.info("Analyzing mood for call", call_id=str(call_id))

    # Get call with transcripts and mood_analysis
    result = await db.execute(
        select(Call)
        .where(Call.id == call_id)
        .options(
            selectinload(Call.transcripts),
            selectinload(Call.mood_analysis),
        )
    )
    call = result.scalar_one_or_none()

    if call is None:
        logger.warning("Call not found for mood analysis", call_id=str(call_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Call with id {call_id} not found",
        )

    # Check if transcripts exist
    if not call.transcripts:
        logger.warning("No transcripts for call", call_id=str(call_id))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot analyze mood: call has no transcripts",
        )

    # Check if mood_analysis already exists
    if call.mood_analysis is not None:
        logger.warning("Mood analysis already exists for call", call_id=str(call_id))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mood analysis already exists for this call",
        )

    # Analyze mood using Anthropic Claude
    try:
        mood_result = await analyze_mood(call_id, call.transcripts)
    except ValueError as e:
        logger.error("Mood analysis failed", call_id=str(call_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze mood: {e}",
        ) from e

    # Create and save mood analysis to database
    mood_analysis = MoodAnalysis(
        call_id=call_id,
        overall_sentiment=mood_result.overall_sentiment,
        confidence=mood_result.confidence,
        flags=mood_result.flags,
        notes=mood_result.notes,
    )

    db.add(mood_analysis)
    await db.flush()
    await db.refresh(mood_analysis)

    logger.info(
        "Mood analysis generated and saved",
        call_id=str(call_id),
        mood_analysis_id=str(mood_analysis.id),
    )
    return mood_analysis


@router.post(
    "/{call_id}/extract-memories",
    response_model=list[MemoryRead],
    status_code=status.HTTP_201_CREATED,
)
async def extract_call_memories(
    call_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[ConversationMemory]:
    """Extract memories from a call's transcripts.

    Args:
        call_id: UUID of the call to extract memories from.
        db: Database session.

    Returns:
        The extracted memories.

    Raises:
        HTTPException: 404 if call not found, 400 if no transcripts, 409 if memories exist.
    """
    logger.info("Extracting memories for call", call_id=str(call_id))

    # Get call with transcripts
    result = await db.execute(
        select(Call)
        .where(Call.id == call_id)
        .options(
            selectinload(Call.transcripts),
        )
    )
    call = result.scalar_one_or_none()

    if call is None:
        logger.warning("Call not found for memory extraction", call_id=str(call_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Call with id {call_id} not found",
        )

    # Check if transcripts exist
    if not call.transcripts:
        logger.warning("No transcripts for call", call_id=str(call_id))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot extract memories: call has no transcripts",
        )

    # Check if memories already exist for this call
    existing_memories_result = await db.execute(
        select(ConversationMemory).where(ConversationMemory.source_call_id == call_id)
    )
    existing_memories = existing_memories_result.scalars().first()

    if existing_memories is not None:
        logger.warning("Memories already exist for call", call_id=str(call_id))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Memories already exist for this call",
        )

    # Extract memories using Anthropic Claude
    try:
        memories = await extract_memories(call_id, call.user_id, call.transcripts)
    except ValueError as e:
        logger.error("Memory extraction failed", call_id=str(call_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract memories: {e}",
        ) from e

    # Save memories to database
    for memory in memories:
        db.add(memory)

    await db.flush()

    # Refresh all memories to get generated fields
    for memory in memories:
        await db.refresh(memory)

    logger.info(
        "Memories extracted and saved",
        call_id=str(call_id),
        memory_count=len(memories),
    )
    return memories


@router.post("/trigger", response_model=CallTriggerResponse, status_code=status.HTTP_201_CREATED)
async def trigger_call(
    request: CallTriggerRequest,
    db: AsyncSession = Depends(get_db),
) -> CallTriggerResponse:
    """Trigger a manual call for a user.

    Creates a new call record, creates a LiveKit room, and returns connection info.

    Args:
        request: Call trigger request with user_id.
        db: Database session.

    Returns:
        Call ID and LiveKit connection details.

    Raises:
        HTTPException: 404 if user not found, 500 if LiveKit setup fails.
    """
    logger.info("Triggering manual call", user_id=str(request.user_id))

    # Get user to verify they exist and get their name
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()

    if user is None:
        logger.warning("User not found for call trigger", user_id=str(request.user_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {request.user_id} not found",
        )

    # Create call record with in_progress status
    from datetime import UTC, datetime

    call = Call(
        user_id=request.user_id,
        status=CallStatus.IN_PROGRESS,
        direction=CallDirection.OUTBOUND,
        started_at=datetime.now(UTC),
    )

    db.add(call)
    await db.flush()
    await db.refresh(call)

    logger.info("Call record created", call_id=str(call.id), user_id=str(user.id))

    # Create LiveKit room and get connection info
    try:
        room_info = await create_room_for_call(
            call_id=str(call.id),
            user_id=str(user.id),
            user_name=user.name,
        )
    except ValueError as e:
        # LiveKit not configured - still return call info but without valid room
        logger.error("LiveKit setup failed", call_id=str(call.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create LiveKit room: {e}",
        ) from e

    # Dispatch agent to the room (non-blocking, agent may not be running)
    dispatch_success = await dispatch_agent_to_room(room_info.room_name)
    if not dispatch_success:
        logger.warning(
            "Agent dispatch failed, user can still join",
            call_id=str(call.id),
            room_name=room_info.room_name,
        )

    logger.info(
        "Manual call triggered successfully",
        call_id=str(call.id),
        room_name=room_info.room_name,
        agent_dispatched=dispatch_success,
    )

    return CallTriggerResponse(
        call_id=call.id,
        room_name=room_info.room_name,
        token=room_info.token,
        livekit_url=room_info.livekit_url,
    )
