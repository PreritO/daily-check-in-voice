"""Summary endpoints."""

from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.schemas import SummaryRead
from src.database import get_db
from src.models import Call, Summary
from src.services import post_summary

logger = structlog.get_logger()

router = APIRouter()


@router.post("/{summary_id}/post-to-slack", response_model=SummaryRead)
async def post_summary_to_slack(
    summary_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> Summary:
    """Post a summary to Slack.

    Args:
        summary_id: UUID of the summary to post.
        db: Database session.

    Returns:
        The updated summary with posted_to_slack=True.

    Raises:
        HTTPException: 404 if summary not found, 400 if already posted.
    """
    logger.info("Posting summary to Slack", summary_id=str(summary_id))

    # Get summary with call and user relationships
    result = await db.execute(
        select(Summary)
        .where(Summary.id == summary_id)
        .options(
            selectinload(Summary.call).selectinload(Call.user),
        )
    )
    summary = result.scalar_one_or_none()

    if summary is None:
        logger.warning("Summary not found", summary_id=str(summary_id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Summary with id {summary_id} not found",
        )

    # Check if already posted
    if summary.posted_to_slack:
        logger.warning("Summary already posted to Slack", summary_id=str(summary_id))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Summary has already been posted to Slack",
        )

    # Get user from the call relationship
    user = summary.call.user

    # Post to Slack
    slack_result = await post_summary(summary, user)

    if not slack_result.success:
        logger.error(
            "Failed to post summary to Slack",
            summary_id=str(summary_id),
            error=slack_result.error,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to post to Slack: {slack_result.error}",
        )

    # Update summary record
    summary.posted_to_slack = True
    summary.slack_message_id = slack_result.message_id

    await db.flush()
    await db.refresh(summary)

    logger.info(
        "Summary posted to Slack",
        summary_id=str(summary_id),
        slack_message_id=slack_result.message_id,
    )

    return summary
