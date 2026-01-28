"""LiveKit service for room management and token generation."""

from dataclasses import dataclass

import structlog
from livekit import api

from src.config import get_settings

logger = structlog.get_logger()


@dataclass
class RoomInfo:
    """Information about a LiveKit room."""

    room_name: str
    token: str
    livekit_url: str


async def create_room_for_call(
    call_id: str,
    user_id: str,
    user_name: str,
) -> RoomInfo:
    """Create a LiveKit room and generate participant token for a call.

    Args:
        call_id: UUID of the call (used to generate room name).
        user_id: UUID of the user.
        user_name: Display name of the user.

    Returns:
        RoomInfo with room name, access token, and LiveKit URL.

    Raises:
        ValueError: If LiveKit credentials are not configured.
    """
    settings = get_settings()

    if not settings.LIVEKIT_API_KEY or not settings.LIVEKIT_API_SECRET:
        logger.error("LiveKit credentials not configured")
        raise ValueError("LiveKit API credentials are not configured")

    if not settings.LIVEKIT_URL:
        logger.error("LiveKit URL not configured")
        raise ValueError("LiveKit URL is not configured")

    # Generate a unique room name based on call_id
    room_name = f"standup-{call_id}"

    logger.info(
        "Creating LiveKit room",
        room_name=room_name,
        call_id=call_id,
        user_id=user_id,
    )

    # Create room using LiveKit API
    lkapi = api.LiveKitAPI(
        settings.LIVEKIT_URL,
        settings.LIVEKIT_API_KEY,
        settings.LIVEKIT_API_SECRET,
    )

    try:
        # Create the room with metadata containing call_id
        import json

        room_metadata = json.dumps({"call_id": call_id, "user_id": user_id})
        await lkapi.room.create_room(
            api.CreateRoomRequest(
                name=room_name,
                metadata=room_metadata,
                empty_timeout=300,  # 5 minutes
                max_participants=2,  # User + Agent
            )
        )
        logger.info("LiveKit room created", room_name=room_name)
    except Exception as e:
        logger.warning("Room creation failed (may already exist)", error=str(e))
        # Room might already exist, which is fine

    # Generate access token for the participant
    token = (
        api.AccessToken(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
        .with_identity(user_id)
        .with_name(user_name)
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            )
        )
        .with_metadata(json.dumps({"user_id": user_id, "call_id": call_id}))
        .to_jwt()
    )

    logger.info(
        "LiveKit token generated",
        room_name=room_name,
        user_id=user_id,
    )

    await lkapi.aclose()

    return RoomInfo(
        room_name=room_name,
        token=token,
        livekit_url=settings.LIVEKIT_URL,
    )


async def dispatch_agent_to_room(room_name: str) -> bool:
    """Dispatch the standup agent to join a room.

    This triggers the agent worker to join the specified room.
    The agent should be running and listening for dispatch requests.

    Args:
        room_name: Name of the room for the agent to join.

    Returns:
        True if dispatch was successful, False otherwise.
    """
    settings = get_settings()

    if not settings.LIVEKIT_API_KEY or not settings.LIVEKIT_API_SECRET:
        logger.error("LiveKit credentials not configured for agent dispatch")
        return False

    if not settings.LIVEKIT_URL:
        logger.error("LiveKit URL not configured for agent dispatch")
        return False

    logger.info("Dispatching agent to room", room_name=room_name)

    lkapi = api.LiveKitAPI(
        settings.LIVEKIT_URL,
        settings.LIVEKIT_API_KEY,
        settings.LIVEKIT_API_SECRET,
    )

    try:
        # Create a dispatch request for the agent
        # The agent worker should be configured to handle this namespace
        await lkapi.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                room=room_name,
                agent_name="standup-agent",
            )
        )
        logger.info("Agent dispatched successfully", room_name=room_name)
        await lkapi.aclose()
        return True
    except Exception as e:
        logger.error("Failed to dispatch agent", room_name=room_name, error=str(e))
        await lkapi.aclose()
        return False
