"""Post-call processing pipeline service."""

from dataclasses import dataclass, field
from uuid import UUID

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models import Alert, Call, ConversationMemory, MoodAnalysis, Summary

from .alert_service import create_mood_alert
from .memory_service import extract_memories
from .mood_service import analyze_mood
from .slack_service import post_summary
from .summary_service import generate_summary

logger = structlog.get_logger()


@dataclass
class PostCallResult:
    """Result of post-call processing pipeline."""

    call_id: UUID
    summary_generated: bool = False
    summary_id: UUID | None = None
    memories_extracted: bool = False
    memory_count: int = 0
    mood_analyzed: bool = False
    mood_analysis_id: UUID | None = None
    alert_created: bool = False
    alert_id: UUID | None = None
    slack_posted: bool = False
    slack_message_id: str | None = None
    errors: list[str] = field(default_factory=list)


async def process_completed_call(
    call_id: UUID,
    db: AsyncSession,
) -> PostCallResult:
    """
    Process a completed call through the full post-call pipeline.

    This runs the following steps in order:
    1. Generate summary from transcripts (if not already generated)
    2. Extract memories from transcripts
    3. Analyze mood from transcripts (if not already analyzed)
    4. Post summary to Slack (if summary exists)

    Each step is wrapped in try/except to collect errors without stopping the pipeline.

    Args:
        call_id: The UUID of the completed call to process.
        db: The async database session.

    Returns:
        PostCallResult containing status of each step and any errors encountered.
    """
    log = logger.bind(call_id=str(call_id))
    log.info("starting_post_call_processing")

    result = PostCallResult(call_id=call_id)

    # Fetch call with all related data
    call_query = (
        select(Call)
        .where(Call.id == call_id)
        .options(
            selectinload(Call.user),
            selectinload(Call.transcripts),
            selectinload(Call.summary),
            selectinload(Call.mood_analysis),
        )
    )
    call_result = await db.execute(call_query)
    call = call_result.scalar_one_or_none()

    if call is None:
        error_msg = f"Call {call_id} not found"
        log.error("call_not_found")
        result.errors.append(error_msg)
        return result

    # Check for transcripts
    if not call.transcripts:
        error_msg = "No transcripts available for processing"
        log.warning("no_transcripts")
        result.errors.append(error_msg)
        return result

    log.info(
        "call_loaded",
        transcript_count=len(call.transcripts),
        has_summary=call.summary is not None,
        has_mood_analysis=call.mood_analysis is not None,
    )

    try:
        # Run all pipeline steps with individual error handling
        result = await _run_pipeline_steps(call, db, log, result)
    except Exception as e:
        # Unexpected error escaped the pipeline - rollback and re-raise
        log.error("unexpected_pipeline_error", error=str(e))
        await db.rollback()
        result.errors.append(f"Unexpected pipeline error: {e}")
        return result

    return result


async def _run_pipeline_steps(
    call: Call,
    db: AsyncSession,
    log: structlog.stdlib.BoundLogger,
    result: PostCallResult,
) -> PostCallResult:
    """
    Run all pipeline steps with individual error handling.

    This is a helper function to allow proper rollback handling in the main function.
    """
    # Step 1: Generate summary
    summary = call.summary
    if summary is None:
        try:
            log.info("generating_summary")
            standup_summary = await generate_summary(call.transcripts)

            summary = Summary(
                call_id=call.id,
                yesterday=standup_summary.yesterday,
                today=standup_summary.today,
                blockers=standup_summary.blockers,
                raw_summary=standup_summary.raw_summary,
                posted_to_slack=False,
            )
            db.add(summary)
            await db.flush()

            result.summary_generated = True
            result.summary_id = summary.id
            log.info("summary_generated", summary_id=str(summary.id))
        except Exception as e:
            error_msg = f"Summary generation failed: {e}"
            log.error("summary_generation_error", error=str(e))
            result.errors.append(error_msg)
    else:
        # Summary already exists
        result.summary_generated = True
        result.summary_id = summary.id
        log.info("summary_already_exists", summary_id=str(summary.id))

    # Step 2: Extract memories (only if not already extracted for this call)
    existing_memories_query = (
        select(func.count())
        .select_from(ConversationMemory)
        .where(ConversationMemory.source_call_id == call.id)
    )
    existing_count_result = await db.execute(existing_memories_query)
    existing_memory_count = existing_count_result.scalar() or 0

    if existing_memory_count == 0:
        try:
            log.info("extracting_memories")
            memories = await extract_memories(
                call_id=call.id,
                user_id=call.user_id,
                transcripts=call.transcripts,
            )

            # Save all memories to database
            for memory in memories:
                db.add(memory)
            await db.flush()

            result.memories_extracted = True
            result.memory_count = len(memories)
            log.info("memories_extracted", count=len(memories))
        except Exception as e:
            error_msg = f"Memory extraction failed: {e}"
            log.error("memory_extraction_error", error=str(e))
            result.errors.append(error_msg)
    else:
        # Memories already extracted for this call
        result.memories_extracted = True
        result.memory_count = existing_memory_count
        log.info("memories_already_extracted", count=existing_memory_count)

    # Step 3: Analyze mood
    mood_analysis_for_alert = None
    if call.mood_analysis is None:
        try:
            log.info("analyzing_mood")
            mood_result = await analyze_mood(
                call_id=call.id,
                transcripts=call.transcripts,
            )

            mood_analysis = MoodAnalysis(
                call_id=call.id,
                overall_sentiment=mood_result.overall_sentiment,
                confidence=mood_result.confidence,
                flags=mood_result.flags,
                notes=mood_result.notes,
            )
            db.add(mood_analysis)
            await db.flush()

            result.mood_analyzed = True
            result.mood_analysis_id = mood_analysis.id
            mood_analysis_for_alert = mood_analysis
            log.info(
                "mood_analyzed",
                mood_analysis_id=str(mood_analysis.id),
                sentiment=mood_result.overall_sentiment.value,
            )
        except Exception as e:
            error_msg = f"Mood analysis failed: {e}"
            log.error("mood_analysis_error", error=str(e))
            result.errors.append(error_msg)
    else:
        # Mood analysis already exists
        result.mood_analyzed = True
        result.mood_analysis_id = call.mood_analysis.id
        mood_analysis_for_alert = call.mood_analysis
        log.info("mood_analysis_already_exists", mood_analysis_id=str(call.mood_analysis.id))

    # Step 3b: Create alert if mood is concerning (but only if no alert exists for this call)
    if mood_analysis_for_alert is not None:
        try:
            # Check if alert already exists for this call to prevent duplicates
            existing_alert_query = select(Alert).where(Alert.call_id == call.id)
            existing_alert_result = await db.execute(existing_alert_query)
            existing_alert = existing_alert_result.scalar_one_or_none()

            if existing_alert is not None:
                log.info("alert_already_exists", alert_id=str(existing_alert.id))
            else:
                alert = create_mood_alert(
                    user_id=call.user_id,
                    call_id=call.id,
                    mood_analysis=mood_analysis_for_alert,
                )
                if alert is not None:
                    db.add(alert)
                    await db.flush()
                    result.alert_created = True
                    result.alert_id = alert.id
                    log.info(
                        "alert_created", alert_id=str(alert.id), alert_type=alert.alert_type.value
                    )
        except Exception as e:
            error_msg = f"Alert creation failed: {e}"
            log.error("alert_creation_error", error=str(e))
            result.errors.append(error_msg)

    # Step 4: Post to Slack if summary exists
    # Use the summary we have (either existing or newly created)
    current_summary = summary if summary is not None else call.summary
    if current_summary is not None and not current_summary.posted_to_slack:
        try:
            log.info("posting_to_slack")
            slack_result = await post_summary(current_summary, call.user)

            if slack_result.success:
                current_summary.posted_to_slack = True
                current_summary.slack_message_id = slack_result.message_id
                await db.flush()

                result.slack_posted = True
                result.slack_message_id = slack_result.message_id
                log.info("slack_posted", message_id=slack_result.message_id)
            else:
                error_msg = f"Slack posting failed: {slack_result.error}"
                log.error("slack_posting_error", error=slack_result.error)
                result.errors.append(error_msg)
        except Exception as e:
            error_msg = f"Slack posting failed: {e}"
            log.error("slack_posting_exception", error=str(e))
            result.errors.append(error_msg)
    elif current_summary is not None and current_summary.posted_to_slack:
        # Already posted to Slack
        result.slack_posted = True
        result.slack_message_id = current_summary.slack_message_id
        log.info("slack_already_posted", message_id=current_summary.slack_message_id)
    else:
        # No summary available to post
        log.warning("no_summary_for_slack")

    # Commit all changes
    await db.commit()

    log.info(
        "post_call_processing_complete",
        summary_generated=result.summary_generated,
        memories_extracted=result.memories_extracted,
        memory_count=result.memory_count,
        mood_analyzed=result.mood_analyzed,
        alert_created=result.alert_created,
        slack_posted=result.slack_posted,
        error_count=len(result.errors),
    )

    return result
