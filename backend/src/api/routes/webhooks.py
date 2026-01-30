"""Twilio webhook endpoints for handling incoming calls."""

from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.request_validator import RequestValidator
from twilio.twiml.voice_response import VoiceResponse

from src.config import get_settings
from src.database import get_db
from src.models import Call, CallStatus, User

logger = structlog.get_logger()

router = APIRouter()


def mask_phone(phone: str) -> str:
    """Mask phone number for logging (privacy).

    Args:
        phone: Full phone number.

    Returns:
        Masked phone number showing only first 3 and last 3 digits.
    """
    if len(phone) <= 6:
        return "****"
    return phone[:3] + "*" * (len(phone) - 6) + phone[-3:]


async def validate_twilio_signature(
    request: Request,
    x_twilio_signature: str = Header(..., alias="X-Twilio-Signature"),
) -> dict[str, Any]:
    """Validate incoming Twilio webhook request signature.

    Args:
        request: The incoming FastAPI request.
        x_twilio_signature: The X-Twilio-Signature header from Twilio.

    Returns:
        The validated form data dictionary.

    Raises:
        HTTPException: 500 if TWILIO_AUTH_TOKEN not configured.
        HTTPException: 403 if signature validation fails.
    """
    settings = get_settings()

    if not settings.TWILIO_AUTH_TOKEN:
        logger.error("TWILIO_AUTH_TOKEN not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Twilio webhook not configured",
        )

    validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)

    # Get the webhook URL - use configured URL or construct from request
    webhook_url = settings.TWILIO_WEBHOOK_URL or str(request.url)

    # Get form data for validation
    form_data = await request.form()
    params = {key: value for key, value in form_data.items()}

    # Validate the request
    is_valid = validator.validate(webhook_url, params, x_twilio_signature)

    if not is_valid:
        logger.warning("Invalid Twilio signature", url=webhook_url)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid Twilio signature",
        )

    logger.debug("Twilio signature validated successfully")
    return params


def generate_reject_twiml(message: str) -> str:
    """Generate TwiML XML to reject a call with a message.

    Args:
        message: Message to play before rejecting.

    Returns:
        TwiML XML string.
    """
    response = VoiceResponse()
    response.say(message)
    response.reject()
    return str(response)


def generate_hangup_twiml(message: str) -> str:
    """Generate TwiML XML to hang up with a message.

    Args:
        message: Message to play before hanging up.

    Returns:
        TwiML XML string.
    """
    response = VoiceResponse()
    response.say(message)
    response.hangup()
    return str(response)


def generate_dial_sip_twiml(sip_uri: str) -> str:
    """Generate TwiML XML to dial a SIP endpoint.

    Args:
        sip_uri: The SIP URI to dial.

    Returns:
        TwiML XML string.
    """
    response = VoiceResponse()
    dial = response.dial()
    dial.sip(sip_uri)
    return str(response)


@router.post("/twilio/incoming")
async def handle_twilio_incoming(
    db: AsyncSession = Depends(get_db),
    form_data: dict[str, Any] = Depends(validate_twilio_signature),
) -> Response:
    """Handle incoming Twilio phone call.

    This endpoint is called by Twilio when a user calls the configured phone number.
    It validates the request, looks up the user by phone number, creates a call record,
    and returns TwiML to connect the call to a LiveKit SIP room.

    Args:
        db: Database session.
        form_data: Validated form data from Twilio (returned by signature validation).

    Returns:
        TwiML XML response to instruct Twilio how to handle the call.
    """
    settings = get_settings()

    # Get data from Twilio form data
    from_number = str(form_data.get("From", ""))
    call_sid = str(form_data.get("CallSid", ""))

    logger.info(
        "Incoming Twilio call",
        from_number_masked=mask_phone(from_number),
        call_sid=call_sid,
    )

    # Look up user by phone number
    result = await db.execute(select(User).where(User.phone_number == from_number))
    user = result.scalars().first()

    if user is None:
        logger.warning(
            "User not found for phone number", phone_number_masked=mask_phone(from_number)
        )
        twiml = generate_reject_twiml(
            "Sorry, this phone number is not registered with Daily Check-In. "
            "Please register your phone number in the dashboard."
        )
        return Response(content=twiml, media_type="application/xml")

    logger.info("User found for incoming call", user_id=str(user.id), user_name=user.name)

    # Check if LiveKit SIP domain is configured
    if not settings.LIVEKIT_SIP_DOMAIN:
        logger.error("LIVEKIT_SIP_DOMAIN not configured")
        twiml = generate_hangup_twiml(
            "Sorry, the voice system is not properly configured. Please contact support."
        )
        return Response(content=twiml, media_type="application/xml")

    # Create call record
    call = Call(
        user_id=user.id,
        status=CallStatus.IN_PROGRESS,
        started_at=datetime.now(UTC),
    )

    db.add(call)
    await db.flush()
    await db.refresh(call)
    await db.commit()

    logger.info(
        "Call record created for incoming call",
        call_id=str(call.id),
        user_id=str(user.id),
    )

    # Generate room name and SIP URI
    room_name = f"standup-{call.id}"
    sip_uri = f"sip:{room_name}@{settings.LIVEKIT_SIP_DOMAIN}"

    logger.info(
        "Connecting call to LiveKit SIP",
        call_id=str(call.id),
        room_name=room_name,
        sip_domain=settings.LIVEKIT_SIP_DOMAIN,
    )

    # Return TwiML to dial the SIP endpoint
    twiml = generate_dial_sip_twiml(sip_uri)
    return Response(content=twiml, media_type="application/xml")
