"""Summary generation service using Anthropic Claude API."""

import os
from dataclasses import dataclass

import anthropic
import structlog

from src.models import Transcript

logger = structlog.get_logger()


@dataclass
class StandupSummary:
    """Structured standup summary extracted from transcripts."""

    yesterday: str
    today: str
    blockers: str | None
    raw_summary: str


SUMMARY_SYSTEM_PROMPT = """You are an assistant that analyzes standup call transcripts and extracts structured information.

Given a transcript of a standup conversation between an agent and a user, extract the following:
1. What the user accomplished yesterday
2. What the user plans to work on today
3. Any blockers or obstacles mentioned (if any)

Be concise and focus on the key points. If information is not mentioned, indicate "Not discussed" rather than making assumptions."""

SUMMARY_USER_PROMPT_TEMPLATE = """Analyze the following standup transcript and extract:
1. Yesterday's accomplishments
2. Today's plans
3. Blockers (if any)

Transcript:
{transcript}

Respond in the following JSON format:
{{
  "yesterday": "Brief summary of what was accomplished yesterday",
  "today": "Brief summary of today's plans",
  "blockers": "Any blockers mentioned, or null if none",
  "raw_summary": "A complete 2-3 sentence summary of the entire standup"
}}

Important: Return ONLY the JSON object, no other text."""


def format_transcript(transcripts: list[Transcript]) -> str:
    """Format transcript entries into a readable conversation format."""
    lines = []
    for entry in sorted(transcripts, key=lambda t: t.timestamp_ms):
        speaker = "Agent" if entry.speaker.value == "agent" else "User"
        lines.append(f"{speaker}: {entry.content}")
    return "\n".join(lines)


async def generate_summary(transcripts: list[Transcript]) -> StandupSummary:
    """
    Generate a structured standup summary from call transcripts using Claude.

    Args:
        transcripts: List of Transcript objects from a call, ordered by timestamp.

    Returns:
        StandupSummary dataclass with extracted yesterday, today, blockers, and raw_summary.

    Raises:
        ValueError: If transcripts list is empty.
        anthropic.APIError: If Claude API call fails.
    """
    if not transcripts:
        raise ValueError("Cannot generate summary from empty transcript list")

    log = logger.bind(transcript_count=len(transcripts))
    log.info("generating_summary")

    # Format the transcript
    formatted_transcript = format_transcript(transcripts)
    log.debug("formatted_transcript", length=len(formatted_transcript))

    # Get API key from environment
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        log.error("anthropic_api_key_missing")
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

    # Create Anthropic client
    client = anthropic.Anthropic(api_key=api_key)

    try:
        # Call Claude API
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=SUMMARY_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": SUMMARY_USER_PROMPT_TEMPLATE.format(transcript=formatted_transcript),
                }
            ],
        )

        # Extract text response
        response_text = message.content[0].text
        log.debug("received_claude_response", response_length=len(response_text))

        # Parse JSON response
        import json

        try:
            parsed = json.loads(response_text)
        except json.JSONDecodeError as e:
            log.error("json_parse_error", error=str(e), response_text=response_text[:200])
            raise ValueError(f"Failed to parse Claude response as JSON: {e}") from e

        # Create and return summary
        summary = StandupSummary(
            yesterday=parsed.get("yesterday", "Not discussed"),
            today=parsed.get("today", "Not discussed"),
            blockers=parsed.get("blockers"),
            raw_summary=parsed.get("raw_summary", ""),
        )

        log.info("summary_generated_successfully")
        return summary

    except anthropic.APIConnectionError as e:
        log.error("anthropic_connection_error", error=str(e))
        raise
    except anthropic.RateLimitError as e:
        log.error("anthropic_rate_limit_error", error=str(e))
        raise
    except anthropic.APIStatusError as e:
        log.error("anthropic_api_status_error", status_code=e.status_code, error=str(e))
        raise
