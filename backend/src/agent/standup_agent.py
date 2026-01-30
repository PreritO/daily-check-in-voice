"""LiveKit Voice Pipeline Agent for standup calls."""

import enum
import json
import time
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

import structlog
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.pipeline import VoicePipelineAgent
from livekit.plugins import silero
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.database import async_session_maker
from src.models import User
from src.services.memory_service import get_user_context

logger = structlog.get_logger()


class ConversationState(enum.Enum):
    """Enumeration of standup conversation states."""

    GREETING = "greeting"
    ASK_YESTERDAY = "ask_yesterday"
    ASK_TODAY = "ask_today"
    ASK_BLOCKERS = "ask_blockers"
    CLOSING = "closing"
    COMPLETED = "completed"


@dataclass
class TranscriptEntry:
    """Represents a single transcript entry."""

    speaker: str  # "agent" or "user"
    content: str
    timestamp_ms: int


@dataclass
class StandupSession:
    """Tracks the state of a standup conversation session."""

    call_id: str | None = None
    user_name: str = "there"
    state: ConversationState = ConversationState.GREETING
    transcript: list[TranscriptEntry] = field(default_factory=list)
    yesterday: str = ""
    today: str = ""
    blockers: str = ""
    start_time_ms: int = 0

    def add_transcript(self, speaker: str, content: str, timestamp_ms: int) -> None:
        """Add a transcript entry."""
        self.transcript.append(
            TranscriptEntry(speaker=speaker, content=content, timestamp_ms=timestamp_ms)
        )

    def advance_state(self) -> ConversationState:
        """Advance to the next conversation state."""
        state_order = [
            ConversationState.GREETING,
            ConversationState.ASK_YESTERDAY,
            ConversationState.ASK_TODAY,
            ConversationState.ASK_BLOCKERS,
            ConversationState.CLOSING,
            ConversationState.COMPLETED,
        ]
        current_index = state_order.index(self.state)
        if current_index < len(state_order) - 1:
            self.state = state_order[current_index + 1]
        return self.state


# Prompts for each conversation state
STANDUP_PROMPTS = {
    ConversationState.GREETING: "Hello, {user_name}! Good morning. Let's do your daily standup. What did you accomplish yesterday?",
    ConversationState.ASK_YESTERDAY: "Great, thanks for sharing. What are you planning to work on today?",
    ConversationState.ASK_TODAY: "Sounds good. Do you have any blockers or things you need help with?",
    ConversationState.ASK_BLOCKERS: "Got it. Thanks for the update!",
    ConversationState.CLOSING: "Thank you for your standup, {user_name}! Have a productive day. Goodbye!",
}

# System prompt for the standup agent
STANDUP_SYSTEM_PROMPT = """You are a friendly standup assistant conducting a daily standup call.
Your job is to ask three main questions:
1. What did you accomplish yesterday?
2. What are you planning to work on today?
3. Do you have any blockers or obstacles?

Guidelines:
- Be concise and conversational
- Listen actively and acknowledge responses briefly before moving to the next question
- Keep the conversation focused on the standup topics
- Be supportive and encouraging
- Thank the user at the end of the standup

IMPORTANT: Follow the conversation flow strictly:
1. Greet the user and ask about yesterday
2. After they respond, acknowledge and ask about today
3. After they respond, acknowledge and ask about blockers
4. After they respond, thank them and say goodbye

Keep your responses brief (1-2 sentences) to maintain a quick standup pace."""


def get_prompt_for_state(state: ConversationState, user_name: str = "there") -> str:
    """Get the appropriate prompt for the current conversation state."""
    prompt_template = STANDUP_PROMPTS.get(state, "")
    return prompt_template.format(user_name=user_name)


async def fetch_agent_context(
    user_id: UUID,
    log: Any,
) -> tuple[str, str, str | None]:
    """Fetch user context for agent personalization.

    Opens a database session and retrieves:
    - User name from the User model
    - Memory context from the memory service
    - Communication style preference

    Args:
        user_id: The UUID of the user to fetch context for.
        log: Logger instance for structured logging.

    Returns:
        Tuple of (user_name, memory_context, communication_style).
        Returns ("there", "", None) if user not found or on error.
    """
    log = log.bind(user_id=str(user_id))
    log.info("fetching_agent_context")

    try:
        async with async_session_maker() as db:
            # Fetch user with preferences using selectinload for eager loading
            result = await db.execute(
                select(User).options(selectinload(User.preferences)).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()

            if not user:
                log.warning("user_not_found_for_context")
                return ("there", "", None)

            # Get user name
            user_name = user.name or "there"

            # Get communication style from preferences
            communication_style: str | None = None
            if user.preferences and user.preferences.communication_style:
                communication_style = user.preferences.communication_style.value

            # Get memory context
            memory_context = await get_user_context(user_id, db)

            log.info(
                "agent_context_fetched",
                user_name=user_name,
                communication_style=communication_style,
                memory_context_length=len(memory_context),
            )

            return (user_name, memory_context, communication_style)

    except Exception as e:
        log.error("failed_to_fetch_agent_context", error=str(e))
        return ("there", "", None)


def build_system_prompt(
    memory_context: str = "",
    communication_style: str | None = None,
) -> str:
    """Build the complete system prompt with personalization.

    Combines the base standup system prompt with communication style
    guidance and user memory context.

    Args:
        memory_context: Formatted string of user memories and context.
        communication_style: The user's preferred communication style
                            ("casual", "formal", or "friendly").

    Returns:
        Complete system prompt with all personalization sections.
    """
    prompt_parts = [STANDUP_SYSTEM_PROMPT]

    # Add communication style guidance
    if communication_style:
        style_guidance = {
            "casual": "Use a casual, relaxed tone.",
            "formal": "Use a professional, formal tone.",
            "friendly": "Use a warm, friendly tone.",
        }
        guidance = style_guidance.get(communication_style)
        if guidance:
            prompt_parts.append(f"\nCommunication Style:\n{guidance}")

    # Add user context from memories
    if memory_context:
        prompt_parts.append(f"\nUser Context:\n{memory_context}")

    return "\n".join(prompt_parts)


def create_standup_agent(
    session: StandupSession,
    log: Any,
    memory_context: str = "",
    communication_style: str | None = None,
) -> VoicePipelineAgent:
    """Create and configure the voice pipeline agent for standup calls.

    Args:
        session: The standup session tracking state.
        log: Logger instance.
        memory_context: Formatted string of user memories for personalization.
        communication_style: User's preferred communication style.

    Returns:
        Configured VoicePipelineAgent.
    """
    # Build the personalized system prompt
    system_prompt = build_system_prompt(
        memory_context=memory_context,
        communication_style=communication_style,
    )

    # Create the initial chat context with system prompt
    initial_ctx = llm.ChatContext().append(
        role="system",
        text=system_prompt,
    )

    # Create the voice pipeline agent
    # Note: For production, replace these with actual STT/LLM/TTS plugins:
    # - STT: AssemblyAI, Deepgram, etc.
    # - LLM: OpenAI, Anthropic, etc.
    # - TTS: Cartesia, ElevenLabs, etc.
    agent = VoicePipelineAgent(
        vad=silero.VAD.load(),
        stt=None,  # Will use default or configure with actual provider
        llm=None,  # Will use default or configure with actual provider
        tts=None,  # Will use default or configure with actual provider
        chat_ctx=initial_ctx,
    )

    @agent.on("user_speech_committed")
    def on_user_speech_committed(msg: llm.ChatMessage) -> None:
        """Handle committed user speech (final transcription)."""
        content = msg.content if isinstance(msg.content, str) else str(msg.content)
        log.info(
            "user_speech_committed",
            state=session.state.value,
            content=content[:100],
        )

        # Store the response based on current state
        if session.state == ConversationState.ASK_YESTERDAY:
            session.yesterday = content
        elif session.state == ConversationState.ASK_TODAY:
            session.today = content
        elif session.state == ConversationState.ASK_BLOCKERS:
            session.blockers = content

        # Add to transcript
        timestamp_ms = int(time.time() * 1000) - session.start_time_ms
        session.add_transcript("user", content, timestamp_ms)

    @agent.on("agent_speech_committed")
    def on_agent_speech_committed(msg: llm.ChatMessage) -> None:
        """Handle committed agent speech."""
        content = msg.content if isinstance(msg.content, str) else str(msg.content)
        log.info(
            "agent_speech_committed",
            state=session.state.value,
            content=content[:100],
        )

        # Add to transcript
        timestamp_ms = int(time.time() * 1000) - session.start_time_ms
        session.add_transcript("agent", content, timestamp_ms)

    return agent


async def run_standup_conversation(
    agent: VoicePipelineAgent,
    session: StandupSession,
    log: Any,
) -> None:
    """Run the standup conversation flow.

    Args:
        agent: The voice pipeline agent.
        session: The standup session tracking state.
        log: Logger instance.
    """
    session.start_time_ms = int(time.time() * 1000)

    # Greeting and ask about yesterday
    greeting = get_prompt_for_state(ConversationState.GREETING, session.user_name)
    session.state = ConversationState.ASK_YESTERDAY
    log.info("standup_greeting", prompt=greeting[:50])
    session.add_transcript("agent", greeting, 0)
    await agent.say(greeting, allow_interruptions=True)

    # The LLM will handle the natural conversation flow from here
    # The agent's system prompt guides it through the questions
    # User responses are captured via the event handlers

    # Wait for conversation to naturally complete
    # The LLM will follow the system prompt to ask all questions
    # and end with a thank you message


async def entrypoint(ctx: JobContext) -> None:
    """Entry point for the LiveKit agent.

    This function is called when a participant joins the room.
    It sets up and starts the voice pipeline agent.
    """
    log = logger.bind(room_name=ctx.room.name)
    log.info("agent_entrypoint_called")

    # Connect to the room
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    log.info("connected_to_room")

    # Wait for a participant to join
    participant = await ctx.wait_for_participant()
    log.info("participant_joined", participant_id=participant.identity)

    # Extract call_id and user_id from room metadata if available
    call_id = None
    user_id_str = None
    if ctx.room.metadata:
        try:
            metadata = json.loads(ctx.room.metadata)
            call_id = metadata.get("call_id")
            user_id_str = metadata.get("user_id")
        except (json.JSONDecodeError, TypeError):
            log.warning("failed_to_parse_room_metadata")

    # Fetch user context if user_id is available
    user_name = "there"
    memory_context = ""
    communication_style = None

    if user_id_str:
        try:
            user_id = UUID(user_id_str)
            user_name, memory_context, communication_style = await fetch_agent_context(user_id, log)
            log.info(
                "user_context_loaded",
                user_id=user_id_str,
                user_name=user_name,
                has_memory_context=bool(memory_context),
                communication_style=communication_style,
            )
        except (ValueError, TypeError) as e:
            log.warning("invalid_user_id_in_metadata", user_id=user_id_str, error=str(e))
    else:
        # Fallback: Extract user name from participant identity
        user_name = participant.identity or "there"
        # Try to extract just the name part if it's an email or complex ID
        if "@" in user_name:
            user_name = user_name.split("@")[0]
        if "_" in user_name:
            user_name = user_name.replace("_", " ").title()
        log.info("using_participant_identity_as_name", user_name=user_name)

    # Initialize the standup session
    session = StandupSession(
        call_id=call_id,
        user_name=user_name,
    )

    # Create the agent with personalization context
    agent = create_standup_agent(
        session,
        log,
        memory_context=memory_context,
        communication_style=communication_style,
    )

    # Start the agent
    agent.start(ctx.room, participant)
    log.info(
        "agent_started",
        participant_id=participant.identity,
        user_name=user_name,
        user_id=user_id_str,
        has_memory_context=bool(memory_context),
    )

    # Run the standup conversation
    await run_standup_conversation(agent, session, log)

    # Log final session state
    log.info(
        "standup_completed",
        call_id=session.call_id,
        transcript_entries=len(session.transcript),
        yesterday_len=len(session.yesterday),
        today_len=len(session.today),
        blockers_len=len(session.blockers),
    )


def main():
    """Main entry point for the agent.

    Run with: python -m src.agent.standup_agent dev
    Or: livekit-agents start src.agent.standup_agent
    """
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        ),
    )


if __name__ == "__main__":
    main()
