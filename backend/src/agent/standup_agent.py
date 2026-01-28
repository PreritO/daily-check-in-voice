"""LiveKit Voice Pipeline Agent for standup calls."""

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

logger = structlog.get_logger()

# System prompt for the standup agent
STANDUP_SYSTEM_PROMPT = """You are a friendly standup assistant conducting a daily standup call.
Your job is to ask three main questions:
1. What did you accomplish yesterday?
2. What are you planning to work on today?
3. Do you have any blockers or obstacles?

Guidelines:
- Be concise and conversational
- Listen actively and acknowledge responses
- Keep the conversation focused on the standup topics
- Be supportive and encouraging
- Thank the user at the end of the standup

Start by greeting the user warmly and asking about their yesterday."""


async def entrypoint(ctx: JobContext):
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

    # Create the initial chat context with system prompt
    initial_ctx = llm.ChatContext().append(
        role="system",
        text=STANDUP_SYSTEM_PROMPT,
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

    # Start the agent
    agent.start(ctx.room, participant)
    log.info("agent_started", participant_id=participant.identity)

    # Wait for the agent to complete
    await agent.say(
        "Hello! Good morning. Let's do your standup. What did you accomplish yesterday?",
        allow_interruptions=True,
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
