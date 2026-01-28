"""Slack integration service for posting standup summaries."""

import os
from dataclasses import dataclass

import httpx
import structlog

from src.models import Summary, User

logger = structlog.get_logger()


@dataclass
class SlackPostResult:
    """Result of posting a message to Slack."""

    success: bool
    message_id: str | None
    error: str | None = None


def build_slack_blocks(summary: Summary, user: User) -> list[dict]:
    """Build Slack Block Kit blocks for a standup summary.

    Args:
        summary: The standup summary to format.
        user: The user who completed the standup.

    Returns:
        List of Slack Block Kit blocks.
    """
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"Daily Standup - {user.name}",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*What I accomplished yesterday:*\n{summary.yesterday}",
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*What I'm working on today:*\n{summary.today}",
            },
        },
    ]

    # Only add blockers section if there are blockers
    if summary.blockers:
        blocks.append(
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Blockers:*\n{summary.blockers}",
                },
            }
        )

    # Add divider and context
    blocks.extend(
        [
            {"type": "divider"},
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": "Posted via Daily Check-In Agent",
                    }
                ],
            },
        ]
    )

    return blocks


async def post_summary(summary: Summary, user: User, channel: str | None = None) -> SlackPostResult:
    """Post a standup summary to Slack.

    Args:
        summary: The summary to post.
        user: The user who completed the standup.
        channel: Optional Slack channel ID. If not provided, uses SLACK_CHANNEL_ID env var.

    Returns:
        SlackPostResult with success status, message_id if successful, or error message.
    """
    log = logger.bind(summary_id=str(summary.id), user_id=str(user.id))
    log.info("posting_summary_to_slack")

    # Get configuration from environment
    bot_token = os.getenv("SLACK_BOT_TOKEN")
    if not bot_token:
        log.error("slack_bot_token_missing")
        return SlackPostResult(
            success=False,
            message_id=None,
            error="SLACK_BOT_TOKEN environment variable is not set",
        )

    target_channel = channel or os.getenv("SLACK_CHANNEL_ID")
    if not target_channel:
        log.error("slack_channel_missing")
        return SlackPostResult(
            success=False,
            message_id=None,
            error="SLACK_CHANNEL_ID environment variable is not set and no channel provided",
        )

    # Build the message
    blocks = build_slack_blocks(summary, user)
    fallback_text = f"Daily Standup - {user.name}"

    # Post to Slack
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://slack.com/api/chat.postMessage",
                headers={
                    "Authorization": f"Bearer {bot_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "channel": target_channel,
                    "text": fallback_text,
                    "blocks": blocks,
                },
                timeout=10.0,
            )

            response_data = response.json()

            if not response_data.get("ok"):
                error_msg = response_data.get("error", "Unknown Slack API error")
                log.error("slack_api_error", error=error_msg)
                return SlackPostResult(
                    success=False,
                    message_id=None,
                    error=f"Slack API error: {error_msg}",
                )

            message_id = response_data.get("ts")
            log.info("slack_message_posted", message_id=message_id, channel=target_channel)

            return SlackPostResult(
                success=True,
                message_id=message_id,
            )

        except httpx.TimeoutException:
            log.error("slack_request_timeout")
            return SlackPostResult(
                success=False,
                message_id=None,
                error="Request to Slack API timed out",
            )
        except httpx.RequestError as e:
            log.error("slack_request_error", error=str(e))
            return SlackPostResult(
                success=False,
                message_id=None,
                error=f"Failed to connect to Slack API: {e}",
            )
