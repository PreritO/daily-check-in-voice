"""FastAPI dependencies for authentication and authorization."""

from typing import Annotated

import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import User
from src.services.auth_service import AuthError, TokenPayload, verify_supabase_token

logger = structlog.get_logger()

# HTTP Bearer scheme for Authorization header
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependency that validates JWT and returns the current user.

    Validates the Supabase JWT token from the Authorization header,
    looks up the user by auth_id, and returns the User model.

    Args:
        credentials: HTTP Authorization credentials containing the JWT.
        db: Database session.

    Returns:
        User model for the authenticated user.

    Raises:
        HTTPException: 401 if token is invalid or user not found.
    """
    try:
        payload: TokenPayload = verify_supabase_token(credentials.credentials)
    except AuthError as e:
        logger.warning("Authentication failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    # Look up user by auth_id
    result = await db.execute(select(User).where(User.auth_id == payload.sub))
    user = result.scalar_one_or_none()

    if user is None:
        logger.warning("User not found for auth_id", auth_id=payload.sub)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found. Please complete registration.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.debug("User authenticated", user_id=str(user.id), email=user.email)
    return user


async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(optional_security)],
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """
    Dependency that optionally validates JWT and returns the user.

    If no token is provided, returns None instead of raising an error.
    Useful for endpoints that work differently for authenticated vs anonymous users.

    Args:
        credentials: Optional HTTP Authorization credentials.
        db: Database session.

    Returns:
        User model if authenticated, None otherwise.
    """
    if credentials is None:
        return None

    try:
        payload: TokenPayload = verify_supabase_token(credentials.credentials)
    except AuthError:
        return None

    result = await db.execute(select(User).where(User.auth_id == payload.sub))
    return result.scalar_one_or_none()


async def get_or_create_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependency that validates JWT and returns or creates the user.

    If the user doesn't exist in the database, creates a new user record
    using information from the JWT token.

    Args:
        credentials: HTTP Authorization credentials containing the JWT.
        db: Database session.

    Returns:
        User model for the authenticated user.

    Raises:
        HTTPException: 401 if token is invalid.
    """
    try:
        payload: TokenPayload = verify_supabase_token(credentials.credentials)
    except AuthError as e:
        logger.warning("Authentication failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    # Look up user by auth_id
    result = await db.execute(select(User).where(User.auth_id == payload.sub))
    user = result.scalar_one_or_none()

    if user is None:
        # Create new user from token payload
        if not payload.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email required for user creation",
            )

        user = User(
            auth_id=payload.sub,
            email=payload.email,
            name=payload.email.split("@")[0],  # Default name from email
        )
        db.add(user)
        await db.flush()  # Get the ID assigned
        logger.info("Created new user from token", user_id=str(user.id), email=user.email)

    return user
