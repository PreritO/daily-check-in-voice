"""Mood analysis service using Anthropic Claude API."""

import json
import os
from dataclasses import dataclass
from uuid import UUID

import anthropic
import structlog

from src.models import SentimentType, Transcript

logger = structlog.get_logger()


VALID_FLAGS = {"confusion", "distress", "loneliness", "health_concern", "unusual_behavior"}


@dataclass
class MoodAnalysisResult:
    """Result of mood analysis from a call transcript."""

    overall_sentiment: SentimentType
    confidence: float
    flags: list[str]
    notes: str | None


MOOD_SYSTEM_PROMPT = """You are an assistant that analyzes standup call transcripts to assess the speaker's mood and emotional state.

Your task is to evaluate the user's emotional wellbeing based on their responses during the conversation. You should identify the overall sentiment and flag any concerns.

Sentiment types:
- POSITIVE: The user seems happy, energetic, or enthusiastic
- NEUTRAL: The user's mood is balanced or unremarkable
- NEGATIVE: The user seems frustrated, sad, or discouraged
- CONCERNED: The user's responses indicate potential issues that may need attention

Flags to detect (only include if clearly evident):
- confusion: User seems disoriented, gives inconsistent answers, or has trouble understanding questions
- distress: User shows signs of emotional distress, anxiety, or being overwhelmed
- loneliness: User expresses feelings of isolation or lack of social connection
- health_concern: User mentions health issues, fatigue, sleep problems, or physical complaints
- unusual_behavior: Responses that seem out of character or indicate significant changes from typical behavior

Guidelines:
- Focus on the user's statements, not the agent's questions
- Be conservative with flags - only flag when there is clear evidence
- Confidence should reflect how certain you are about the sentiment assessment (0.0 to 1.0)
- Notes should provide brief context for any flags or concerning patterns
- Do not make assumptions beyond what is explicitly stated"""

MOOD_USER_PROMPT_TEMPLATE = """Analyze the following standup transcript for mood and emotional state.

Transcript:
{transcript}

Assess the user's overall sentiment and identify any concerning patterns.

Respond in the following JSON format:
{{
  "overall_sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "CONCERNED",
  "confidence": 0.0-1.0,
  "flags": ["flag1", "flag2"],
  "notes": "Brief explanation of analysis or null if no notable concerns"
}}

Valid flags are: confusion, distress, loneliness, health_concern, unusual_behavior
Only include flags that are clearly evident in the transcript.

Important: Return ONLY the JSON object, no other text."""


def _format_transcript(transcripts: list[Transcript]) -> str:
    """Format transcript entries into a readable conversation format."""
    lines = []
    for entry in sorted(transcripts, key=lambda t: t.timestamp_ms):
        speaker = "Agent" if entry.speaker.value == "agent" else "User"
        lines.append(f"{speaker}: {entry.content}")
    return "\n".join(lines)


def _parse_sentiment_type(sentiment_str: str) -> SentimentType:
    """Parse sentiment type string to SentimentType enum."""
    sentiment_map = {
        "POSITIVE": SentimentType.POSITIVE,
        "NEUTRAL": SentimentType.NEUTRAL,
        "NEGATIVE": SentimentType.NEGATIVE,
        "CONCERNED": SentimentType.CONCERNED,
    }
    return sentiment_map.get(sentiment_str.upper(), SentimentType.NEUTRAL)


def _clamp_confidence(confidence: float | int | str) -> float:
    """Clamp confidence value to 0.0-1.0 range, handling non-float inputs."""
    try:
        value = float(confidence)
    except (ValueError, TypeError):
        return 0.5  # Default on invalid input
    return max(0.0, min(1.0, value))


def _validate_flags(flags: list | None) -> list[str]:
    """Validate and filter flags to only include valid values."""
    if not flags or not isinstance(flags, list):
        return []

    validated = []
    for flag in flags:
        if isinstance(flag, str):
            flag_lower = flag.lower().strip()
            if flag_lower in VALID_FLAGS:
                validated.append(flag_lower)
    return validated


async def analyze_mood(
    call_id: UUID,
    transcripts: list[Transcript],
) -> MoodAnalysisResult:
    """
    Analyze mood from call transcripts using Claude.

    Args:
        call_id: The ID of the call to analyze.
        transcripts: List of Transcript objects from the call, ordered by timestamp.

    Returns:
        MoodAnalysisResult containing sentiment, confidence, flags, and notes.

    Raises:
        ValueError: If transcripts list is empty or API key is missing.
        anthropic.APIConnectionError: If connection to Claude API fails.
        anthropic.RateLimitError: If rate limit is exceeded.
        anthropic.APIStatusError: If Claude API returns an error status.
    """
    if not transcripts:
        raise ValueError("Cannot analyze mood from empty transcript list")

    log = logger.bind(call_id=str(call_id), transcript_count=len(transcripts))
    log.info("analyzing_mood")

    # Format the transcript
    formatted_transcript = _format_transcript(transcripts)
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
            system=MOOD_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": MOOD_USER_PROMPT_TEMPLATE.format(transcript=formatted_transcript),
                }
            ],
        )

        # Extract text response
        if not message.content:
            log.error("empty_claude_response")
            raise ValueError("Claude returned an empty response")
        response_text = message.content[0].text
        log.debug("received_claude_response", response_length=len(response_text))

        # Parse JSON response
        try:
            parsed = json.loads(response_text)
        except json.JSONDecodeError as e:
            log.error("json_parse_error", error=str(e))
            raise ValueError(f"Failed to parse Claude response as JSON: {e}") from e

        # Extract and validate fields
        overall_sentiment = _parse_sentiment_type(parsed.get("overall_sentiment", "NEUTRAL"))
        confidence = _clamp_confidence(parsed.get("confidence", 0.5))
        flags = _validate_flags(parsed.get("flags"))
        notes = parsed.get("notes")

        # Ensure notes is a string or None
        if notes is not None and not isinstance(notes, str):
            notes = str(notes) if notes else None

        result = MoodAnalysisResult(
            overall_sentiment=overall_sentiment,
            confidence=confidence,
            flags=flags,
            notes=notes,
        )

        log.info(
            "mood_analysis_complete",
            sentiment=overall_sentiment.value,
            confidence=confidence,
            flag_count=len(flags),
            has_notes=notes is not None,
        )

        return result

    except anthropic.APIConnectionError as e:
        log.error("anthropic_connection_error", error=str(e))
        raise
    except anthropic.RateLimitError as e:
        log.error("anthropic_rate_limit_error", error=str(e))
        raise
    except anthropic.APIStatusError as e:
        log.error("anthropic_api_status_error", status_code=e.status_code, error=str(e))
        raise
