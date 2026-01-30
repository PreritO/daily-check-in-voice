"""Scheduler service for managing scheduled standup calls with APScheduler."""

import contextlib
from datetime import UTC, datetime
from uuid import UUID

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.database import async_session_maker
from src.models.call import Call, CallStatus
from src.models.schedule import Schedule
from src.models.user import User

from .livekit_service import create_room_for_call, dispatch_agent_to_room

logger = structlog.get_logger()

# Module-level singleton scheduler
_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler | None:
    """Get the scheduler instance.

    Returns:
        The AsyncIOScheduler instance, or None if not initialized.
    """
    return _scheduler


def _parse_cron_expression(cron_expr: str) -> dict[str, str]:
    """Parse a cron expression string into CronTrigger kwargs.

    Supports standard 5-field cron format: minute hour day month day_of_week

    Args:
        cron_expr: Cron expression string (e.g., "0 9 * * 1-5" for 9 AM weekdays).

    Returns:
        Dictionary of kwargs for CronTrigger.

    Raises:
        ValueError: If the cron expression is invalid.
    """
    parts = cron_expr.strip().split()

    if len(parts) != 5:
        raise ValueError(
            f"Invalid cron expression '{cron_expr}': expected 5 fields "
            "(minute hour day month day_of_week)"
        )

    return {
        "minute": parts[0],
        "hour": parts[1],
        "day": parts[2],
        "month": parts[3],
        "day_of_week": parts[4],
    }


async def _trigger_scheduled_call(schedule_id: str, user_id: str) -> None:
    """Internal job handler that triggers a scheduled call.

    This function is called by APScheduler when a scheduled job fires.
    It creates a new call record and dispatches the voice agent.

    Args:
        schedule_id: UUID of the schedule that triggered this call.
        user_id: UUID of the user to call.
    """
    log = logger.bind(schedule_id=schedule_id, user_id=user_id)
    log.info("scheduled_call_triggered")

    async with async_session_maker() as session:
        call = None
        try:
            # Fetch user to get their name
            result = await session.execute(select(User).where(User.id == UUID(user_id)))
            user = result.scalar_one_or_none()

            if not user:
                log.error("user_not_found_for_scheduled_call")
                # Remove orphaned job since user no longer exists
                remove_schedule_job(schedule_id)
                return

            # Create a new call record with SCHEDULED status
            call = Call(
                user_id=UUID(user_id),
                status=CallStatus.SCHEDULED,
                scheduled_at=datetime.now(UTC),
            )
            session.add(call)
            await session.flush()  # Get call.id without committing

            log = log.bind(call_id=str(call.id))
            log.info("call_record_created")

            # Create LiveKit room and dispatch agent
            room_info = await create_room_for_call(
                call_id=str(call.id),
                user_id=user_id,
                user_name=user.name,
            )

            # Update call status to IN_PROGRESS
            call.status = CallStatus.IN_PROGRESS
            call.started_at = datetime.now(UTC)

            # Dispatch agent to the room
            dispatch_success = await dispatch_agent_to_room(room_info.room_name)

            if not dispatch_success:
                log.error("agent_dispatch_failed", room_name=room_info.room_name)
                call.status = CallStatus.FAILED
            else:
                log.info("agent_dispatched", room_name=room_info.room_name)

            # Update schedule's next_run_at
            schedule_result = await session.execute(
                select(Schedule).where(Schedule.id == UUID(schedule_id))
            )
            schedule = schedule_result.scalar_one_or_none()

            if schedule and _scheduler:
                job = _scheduler.get_job(f"schedule_{schedule_id}")
                if job and job.next_run_time:
                    schedule.next_run_at = job.next_run_time
                    log.info("next_run_at_updated", next_run_at=str(schedule.next_run_at))

            # Single commit at the end of successful operations
            await session.commit()

        except Exception as e:
            log.exception("scheduled_call_error", error=str(e))
            with contextlib.suppress(Exception):
                await session.rollback()
            # If call was created, mark it as failed in a new transaction
            if call and call.id:
                async with async_session_maker() as error_session:
                    with contextlib.suppress(Exception):
                        result = await error_session.execute(select(Call).where(Call.id == call.id))
                        failed_call = result.scalar_one_or_none()
                        if failed_call:
                            failed_call.status = CallStatus.FAILED
                            await error_session.commit()


def add_schedule_job(schedule: Schedule, user_timezone: str) -> bool:
    """Add or update an APScheduler job for a schedule.

    Args:
        schedule: The Schedule model instance.
        user_timezone: The user's timezone string (e.g., "America/New_York").

    Returns:
        True if job was added successfully, False otherwise.
    """
    if _scheduler is None:
        logger.error("scheduler_not_initialized", action="add_job")
        return False

    job_id = f"schedule_{schedule.id}"

    log = logger.bind(
        job_id=job_id,
        schedule_id=str(schedule.id),
        user_id=str(schedule.user_id),
        cron_expression=schedule.cron_expression,
        timezone=user_timezone,
    )

    try:
        cron_kwargs = _parse_cron_expression(schedule.cron_expression)
    except ValueError as e:
        log.error("invalid_cron_expression", error=str(e))
        return False

    try:
        trigger = CronTrigger(
            **cron_kwargs,
            timezone=user_timezone,
        )

        _scheduler.add_job(
            _trigger_scheduled_call,
            trigger=trigger,
            id=job_id,
            args=[str(schedule.id), str(schedule.user_id)],
            replace_existing=True,
            name=f"Standup call for schedule {schedule.id}",
        )

        # Get next run time
        job = _scheduler.get_job(job_id)
        next_run = job.next_run_time if job else None

        log.info("schedule_job_added", next_run_at=str(next_run) if next_run else None)
        return True

    except Exception as e:
        log.exception("schedule_job_add_failed", error=str(e))
        return False


def remove_schedule_job(schedule_id: str | UUID) -> bool:
    """Remove an APScheduler job for a schedule.

    Args:
        schedule_id: The UUID of the schedule.

    Returns:
        True if job was removed successfully, False otherwise.
    """
    if _scheduler is None:
        logger.error("scheduler_not_initialized", action="remove_job")
        return False

    job_id = f"schedule_{schedule_id}"
    log = logger.bind(job_id=job_id, schedule_id=str(schedule_id))

    try:
        job = _scheduler.get_job(job_id)
        if job:
            _scheduler.remove_job(job_id)
            log.info("schedule_job_removed")
            return True
        else:
            log.warning("schedule_job_not_found")
            return False

    except Exception as e:
        log.exception("schedule_job_remove_failed", error=str(e))
        return False


async def _load_existing_schedules() -> int:
    """Load all enabled schedules from the database and add them to the scheduler.

    Returns:
        Number of schedules loaded successfully.
    """
    logger.info("loading_existing_schedules")

    loaded_count = 0

    async with async_session_maker() as session:
        try:
            # Fetch all enabled schedules with their users (for timezone)
            result = await session.execute(
                select(Schedule)
                .options(selectinload(Schedule.user))
                .where(Schedule.enabled == True)  # noqa: E712
            )
            schedules = list(result.scalars().all())

            logger.info("enabled_schedules_found", count=len(schedules))

            for schedule in schedules:
                user_timezone = schedule.user.timezone if schedule.user else "UTC"

                if add_schedule_job(schedule, user_timezone):
                    loaded_count += 1

                    # Update next_run_at in database
                    if _scheduler:
                        job = _scheduler.get_job(f"schedule_{schedule.id}")
                        if job and job.next_run_time:
                            schedule.next_run_at = job.next_run_time

            await session.commit()

            logger.info(
                "schedules_loaded",
                loaded_count=loaded_count,
                total_enabled=len(schedules),
            )

        except Exception as e:
            logger.exception("load_schedules_failed", error=str(e))
            await session.rollback()

    return loaded_count


async def start_scheduler() -> AsyncIOScheduler:
    """Initialize and start the APScheduler.

    This function initializes the scheduler, loads existing schedules from
    the database, and starts the scheduler.

    Returns:
        The initialized AsyncIOScheduler instance.
    """
    global _scheduler

    if _scheduler is not None:
        logger.warning("scheduler_already_initialized")
        return _scheduler

    logger.info("scheduler_initializing")

    _scheduler = AsyncIOScheduler(
        timezone="UTC",
        job_defaults={
            "coalesce": True,  # Combine missed job executions into one
            "max_instances": 1,  # Only one instance of each job at a time
            "misfire_grace_time": 60,  # Allow 60 seconds grace for misfired jobs
        },
    )

    # Start the scheduler before loading jobs
    _scheduler.start()
    logger.info("scheduler_started")

    # Load existing schedules from database
    loaded_count = await _load_existing_schedules()
    logger.info("scheduler_initialization_complete", loaded_schedules=loaded_count)

    return _scheduler


async def shutdown_scheduler() -> None:
    """Gracefully shutdown the scheduler.

    This function stops the scheduler and clears the singleton reference.
    """
    global _scheduler

    if _scheduler is None:
        logger.warning("scheduler_not_initialized_for_shutdown")
        return

    logger.info("scheduler_shutting_down")

    try:
        _scheduler.shutdown(wait=True)
        logger.info("scheduler_shutdown_complete")
    except Exception as e:
        logger.exception("scheduler_shutdown_error", error=str(e))
    finally:
        _scheduler = None
