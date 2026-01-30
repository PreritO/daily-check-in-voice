"""Memory extraction and retrieval service using Anthropic Claude API."""

import json
import os
import re
from dataclasses import dataclass
from datetime import date
from uuid import UUID

import anthropic
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import ConversationMemory, MemoryType, Transcript

logger = structlog.get_logger()


@dataclass
class ExtractedMemory:
    """Individual memory extracted from conversation."""

    memory_type: MemoryType
    content: str
    importance: int  # 1-10 scale


@dataclass
class MemoryExtractionResult:
    """Result of memory extraction containing all memories and raw response."""

    memories: list[ExtractedMemory]
    raw_response: str


MEMORY_SYSTEM_PROMPT = """You are an assistant that analyzes standup call transcripts and extracts important memories about the user.

Your task is to identify key facts, preferences, events, and relationships mentioned in the conversation that would be valuable to remember for future interactions.

Memory types:
- FACT: Objective information about the user (e.g., "Works on the payments team", "Uses Python primarily")
- PREFERENCE: User preferences and likes/dislikes (e.g., "Prefers morning standups", "Likes detailed feedback")
- EVENT: Significant events or milestones (e.g., "Starting a new project next week", "Just completed a major feature")
- RELATIONSHIP: Information about people or teams the user works with (e.g., "Reports to Sarah", "Collaborates with the frontend team")

Guidelines:
- Only extract genuinely useful information that would help personalize future interactions
- Assign importance scores based on how useful the memory would be for future conversations
- Be concise but capture the essential meaning
- Do not make assumptions - only extract what is explicitly stated
- Focus on user statements, not agent statements"""

MEMORY_USER_PROMPT_TEMPLATE = """Analyze the following standup transcript and extract important memories about the user.

Transcript:
{transcript}

For each memory, provide:
1. The type (FACT, PREFERENCE, EVENT, or RELATIONSHIP)
2. A concise description of the memory
3. An importance score from 1-10 (10 being most important for future interactions)

Respond in the following JSON format:
{{
  "memories": [
    {{
      "type": "FACT",
      "content": "Description of the memory",
      "importance": 7
    }}
  ]
}}

If no significant memories are found, return an empty memories array.
Important: Return ONLY the JSON object, no other text."""


def _format_transcript(transcripts: list[Transcript]) -> str:
    """Format transcript entries into a readable conversation format."""
    lines = []
    for entry in sorted(transcripts, key=lambda t: t.timestamp_ms):
        speaker = "Agent" if entry.speaker.value == "agent" else "User"
        lines.append(f"{speaker}: {entry.content}")
    return "\n".join(lines)


def _parse_memory_type(type_str: str) -> MemoryType:
    """Parse memory type string to MemoryType enum."""
    type_map = {
        "FACT": MemoryType.FACT,
        "PREFERENCE": MemoryType.PREFERENCE,
        "EVENT": MemoryType.EVENT,
        "RELATIONSHIP": MemoryType.RELATIONSHIP,
    }
    return type_map.get(type_str.upper(), MemoryType.FACT)


def _clamp_importance(importance: int | float | str) -> int:
    """Clamp importance value to 1-10 range, handling non-integer inputs."""
    try:
        value = int(importance)
    except (ValueError, TypeError):
        return 5  # Default on invalid input
    return max(1, min(10, value))


async def extract_memories(
    call_id: UUID,
    user_id: UUID,
    transcripts: list[Transcript],
) -> list[ConversationMemory]:
    """
    Extract memories from call transcripts using Claude.

    Args:
        call_id: The ID of the call to extract memories from.
        user_id: The ID of the user who made the call.
        transcripts: List of Transcript objects from the call, ordered by timestamp.

    Returns:
        List of ConversationMemory objects (unsaved - caller handles persistence).

    Raises:
        ValueError: If transcripts list is empty or API key is missing.
        anthropic.APIError: If Claude API call fails.
    """
    if not transcripts:
        raise ValueError("Cannot extract memories from empty transcript list")

    log = logger.bind(call_id=str(call_id), user_id=str(user_id), transcript_count=len(transcripts))
    log.info("extracting_memories")

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
            max_tokens=2048,
            system=MEMORY_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": MEMORY_USER_PROMPT_TEMPLATE.format(transcript=formatted_transcript),
                }
            ],
        )

        # Extract text response
        response_text = message.content[0].text
        log.debug("received_claude_response", response_length=len(response_text))

        # Parse JSON response
        try:
            parsed = json.loads(response_text)
        except json.JSONDecodeError as e:
            log.error("json_parse_error", error=str(e))
            raise ValueError(f"Failed to parse Claude response as JSON: {e}") from e

        # Extract memories from parsed response
        raw_memories = parsed.get("memories", [])
        extracted_memories: list[ExtractedMemory] = []

        for mem in raw_memories:
            if not isinstance(mem, dict):
                log.warning("invalid_memory_format", memory=mem)
                continue

            content = mem.get("content", "").strip()
            if not content:
                log.warning("empty_memory_content", memory=mem)
                continue

            extracted_memories.append(
                ExtractedMemory(
                    memory_type=_parse_memory_type(mem.get("type", "FACT")),
                    content=content,
                    importance=_clamp_importance(mem.get("importance", 5)),
                )
            )

        log.info("memories_extracted", count=len(extracted_memories))

        # Convert to ConversationMemory objects (unsaved)
        conversation_memories: list[ConversationMemory] = []
        for extracted in extracted_memories:
            memory = ConversationMemory(
                user_id=user_id,
                memory_type=extracted.memory_type,
                content=extracted.content,
                source_call_id=call_id,
                importance=extracted.importance,
            )
            conversation_memories.append(memory)

        log.info("conversation_memories_created", count=len(conversation_memories))
        return conversation_memories

    except anthropic.APIConnectionError as e:
        log.error("anthropic_connection_error", error=str(e))
        raise
    except anthropic.RateLimitError as e:
        log.error("anthropic_rate_limit_error", error=str(e))
        raise
    except anthropic.APIStatusError as e:
        log.error("anthropic_api_status_error", status_code=e.status_code, error=str(e))
        raise


def _is_date_relevant(memory: ConversationMemory, ref_date: date) -> bool:
    """Check if an EVENT memory content mentions a date matching the reference date.

    This parses the memory content for date patterns (birthdays, anniversaries,
    specific dates) and checks if they match the reference date's month and day.

    Args:
        memory: The ConversationMemory to check.
        ref_date: The reference date to check against (typically today).

    Returns:
        True if the memory content mentions a date matching ref_date, False otherwise.
    """
    if memory.memory_type != MemoryType.EVENT:
        return False

    content_lower = memory.content.lower()

    # Month names and abbreviations
    month_names = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
    ]
    month_abbrevs = [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
    ]

    ref_month_name = month_names[ref_date.month - 1]
    ref_month_abbrev = month_abbrevs[ref_date.month - 1]
    ref_day = ref_date.day

    # Check for birthday/anniversary mentions with matching month
    has_event_keyword = "birthday" in content_lower or "anniversary" in content_lower
    has_matching_month = ref_month_name in content_lower or ref_month_abbrev in content_lower
    if has_event_keyword and has_matching_month:
        # Check for day number near the month
        day_pattern = rf"\b{ref_day}(?:st|nd|rd|th)?\b"
        if re.search(day_pattern, content_lower):
            return True

    # Check for specific date patterns like "January 29", "Jan 29", "1/29", "01-29"
    date_patterns = [
        rf"{ref_month_name}\s+{ref_day}(?:st|nd|rd|th)?",  # January 29, January 29th
        rf"{ref_month_abbrev}\.?\s+{ref_day}(?:st|nd|rd|th)?",  # Jan 29, Jan. 29th
        rf"\b{ref_date.month}/{ref_day}\b",  # 1/29
        rf"\b0?{ref_date.month}-0?{ref_day}\b",  # 1-29 or 01-29
    ]

    return any(re.search(pattern, content_lower) for pattern in date_patterns)


def _format_context_string(
    important: list[ConversationMemory],
    recent: list[ConversationMemory],
    date_relevant: list[ConversationMemory],
) -> str:
    """Format memories into an LLM-friendly context string.

    Args:
        important: List of top important memories.
        recent: List of recent memories (already deduplicated from important).
        date_relevant: List of date-relevant EVENT memories.

    Returns:
        Formatted string with sections for each memory category.
    """
    sections: list[str] = []

    # Key information section
    if important:
        lines = ["Key information about this user:"]
        for mem in important:
            lines.append(f"- {mem.content}")
        sections.append("\n".join(lines))

    # Recent context section
    if recent:
        lines = ["Recent context:"]
        for mem in recent:
            lines.append(f"- {mem.content}")
        sections.append("\n".join(lines))

    # Date-relevant section
    if date_relevant:
        lines = ["Relevant for today:"]
        for mem in date_relevant:
            lines.append(f"- {mem.content}")
        sections.append("\n".join(lines))

    return "\n\n".join(sections)


async def get_user_context(
    user_id: UUID,
    db: AsyncSession,
    reference_date: date | None = None,
) -> str:
    """Retrieve and format user memories for agent context injection.

    This function retrieves the most important and recent memories for a user,
    along with any date-relevant event memories, and formats them into a string
    suitable for LLM prompt injection.

    Args:
        user_id: The UUID of the user to retrieve memories for.
        db: The async database session.
        reference_date: The reference date for checking date relevance.
                       Defaults to today if not provided.

    Returns:
        A formatted string containing user context from memories.
        Returns empty string if no memories exist or on database error.
    """
    log = logger.bind(user_id=str(user_id))
    log.debug("retrieving_user_context")

    if reference_date is None:
        reference_date = date.today()

    try:
        # Retrieve top 10 most important memories
        important_result = await db.execute(
            select(ConversationMemory)
            .where(ConversationMemory.user_id == user_id)
            .order_by(ConversationMemory.importance.desc())
            .limit(10)
        )
        important_memories = list(important_result.scalars().all())
        important_ids = {mem.id for mem in important_memories}

        log.debug("retrieved_important_memories", count=len(important_memories))

        # Retrieve last 5 recent memories (excluding those already in important)
        recent_query = (
            select(ConversationMemory)
            .where(ConversationMemory.user_id == user_id)
            .order_by(ConversationMemory.created_at.desc())
            .limit(5)
        )
        if important_ids:
            recent_query = recent_query.where(ConversationMemory.id.notin_(important_ids))
        recent_result = await db.execute(recent_query)
        recent_memories = list(recent_result.scalars().all())

        log.debug("retrieved_recent_memories", count=len(recent_memories))

        # Find date-relevant EVENT memories
        # We check all EVENT memories to find any that mention today's date
        all_event_result = await db.execute(
            select(ConversationMemory)
            .where(ConversationMemory.user_id == user_id)
            .where(ConversationMemory.memory_type == MemoryType.EVENT)
        )
        all_events = list(all_event_result.scalars().all())

        date_relevant_memories = [
            mem for mem in all_events if _is_date_relevant(mem, reference_date)
        ]

        # Deduplicate: remove date-relevant memories already in important or recent
        already_shown_ids = important_ids | {mem.id for mem in recent_memories}
        date_relevant_memories = [
            mem for mem in date_relevant_memories if mem.id not in already_shown_ids
        ]

        log.debug("retrieved_date_relevant_memories", count=len(date_relevant_memories))

        # Format and return
        context = _format_context_string(
            important=important_memories,
            recent=recent_memories,
            date_relevant=date_relevant_memories,
        )

        log.info(
            "user_context_generated",
            important_count=len(important_memories),
            recent_count=len(recent_memories),
            date_relevant_count=len(date_relevant_memories),
            context_length=len(context),
        )

        return context

    except Exception as e:
        log.error("failed_to_retrieve_user_context", error=str(e))
        return ""  # Graceful degradation - return empty context
