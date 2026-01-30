"""Authentication service for validating Supabase JWT tokens."""

from dataclasses import dataclass

import jwt
import structlog
from jwt import PyJWKClient

from src.config import get_settings

logger = structlog.get_logger()

# Cache the JWKS client at module level for performance
_jwks_client: PyJWKClient | None = None


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


def _get_jwks_client() -> PyJWKClient:
    """Get or create the JWKS client for token verification."""
    global _jwks_client
    if _jwks_client is None:
        settings = get_settings()
        if not settings.SUPABASE_URL:
            raise AuthError("SUPABASE_URL not configured")
        jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


def verify_supabase_token(token: str) -> TokenPayload:
    """
    Verify a Supabase JWT token and return the payload.

    Supabase uses ES256 algorithm with JWKS for token verification.

    Args:
        token: The JWT token from the Authorization header.

    Returns:
        TokenPayload with user information.

    Raises:
        AuthError: If token is invalid, expired, or verification fails.
    """
    settings = get_settings()

    if not settings.SUPABASE_URL:
        raise AuthError("SUPABASE_URL not configured")

    try:
        # Get the signing key from JWKS
        jwks_client = _get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Decode and verify the token
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
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
    except Exception as e:
        logger.warning("Token verification failed", error=str(e))
        raise AuthError("Invalid token") from e
