"""Authentication service for validating Supabase JWT tokens."""

from dataclasses import dataclass

import httpx
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

    Args:
        token: The JWT token from the Authorization header.

    Returns:
        TokenPayload with user information.

    Raises:
        AuthError: If token is invalid, expired, or verification fails.
    """
    settings = get_settings()
    try:
        jwks_client = _get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience="authenticated",
            issuer=f"{settings.SUPABASE_URL}/auth/v1",
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
    except jwt.InvalidIssuerError as e:
        logger.warning("Invalid token issuer")
        raise AuthError("Invalid token issuer") from e
    except jwt.InvalidTokenError as e:
        logger.warning("Invalid token", error=str(e))
        raise AuthError("Invalid token") from e
    except httpx.HTTPError as e:
        logger.error("Failed to fetch JWKS", error=str(e))
        raise AuthError("Failed to verify token") from e


def reset_jwks_client() -> None:
    """Reset the JWKS client (useful for testing)."""
    global _jwks_client
    _jwks_client = None
