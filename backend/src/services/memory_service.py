"""Memory extraction service using Anthropic Claude API."""

import json
import os
from dataclasses import dataclass
from uuid import UUID

import anthropic
import structlog

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
