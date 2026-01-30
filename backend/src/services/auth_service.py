"""Authentication service for validating Supabase JWT tokens."""

from dataclasses import dataclass

import jwt
import structlog

from src.config import get_settings

logger = structlog.get_logger()


@dataclass
class TokenPayload:
    """Decoded JWT token payload."""

    sub: str  # Supabase user ID (auth_id)
    email: str | None
    role: str
    aud: str


class AuthError(Exception):
    """Authentication error."""

    pass


def verify_supabase_token(token: str) -> TokenPayload:
    """
    Verify a Supabase JWT token and return the payload.

    Supabase uses HS256 algorithm with a JWT secret by default.

    Args:
        token: The JWT token from the Authorization header.

    Returns:
        TokenPayload with user information.

    Raises:
        AuthError: If token is invalid, expired, or verification fails.
    """
    settings = get_settings()

    if not settings.SUPABASE_JWT_SECRET:
        raise AuthError("SUPABASE_JWT_SECRET not configured")

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )

        # Extract fields from payload
        sub = payload.get("sub")
        if not sub:
            raise AuthError("Token missing 'sub' claim")

        return TokenPayload(
            sub=sub,
            email=payload.get("email"),
            role=payload.get("role", "authenticated"),
            aud=payload.get("aud", "authenticated"),
        )

    except jwt.ExpiredSignatureError as e:
        logger.warning("Token expired")
        raise AuthError("Token has expired") from e
    except jwt.InvalidAudienceError as e:
        logger.warning("Invalid token audience")
        raise AuthError("Invalid token audience") from e
    except jwt.InvalidTokenError as e:
        logger.warning("Invalid token", error=str(e))
        raise AuthError("Invalid token") from e
