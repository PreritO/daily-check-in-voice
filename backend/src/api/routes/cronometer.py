"""Cronometer integration API endpoints."""

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_or_create_user
from src.api.schemas import (
    CredentialStatusResponse,
    SaveCredentialsRequest,
)
from src.database import get_db
from src.models import CronometerCredential, User
from src.utils.encryption import encrypt_string

logger = structlog.get_logger()

router = APIRouter()


@router.post("/credentials", status_code=status.HTTP_201_CREATED)
async def save_credentials(
    request: SaveCredentialsRequest,
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> CredentialStatusResponse:
    """Save encrypted Cronometer credentials for the current user.

    Args:
        request: Email and password to save.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        Credential status after saving.
    """
    # Check if credentials already exist
    result = await db.execute(
        select(CronometerCredential).where(CronometerCredential.user_id == current_user.id)
    )
    credential = result.scalar_one_or_none()

    # Encrypt credentials
    encrypted_email = encrypt_string(request.email)
    encrypted_password = encrypt_string(request.password)

    if credential:
        # Update existing credentials
        credential.encrypted_email = encrypted_email
        credential.encrypted_password = encrypted_password
        logger.info("Updated Cronometer credentials", user_id=str(current_user.id))
    else:
        # Create new credentials
        credential = CronometerCredential(
            user_id=current_user.id,
            encrypted_email=encrypted_email,
            encrypted_password=encrypted_password,
        )
        db.add(credential)
        logger.info("Saved Cronometer credentials", user_id=str(current_user.id))

    await db.flush()
    await db.refresh(credential)

    return CredentialStatusResponse(
        has_credentials=True,
        last_sync_at=credential.last_sync_at,
    )


@router.get("/credentials/status", response_model=CredentialStatusResponse)
async def get_credential_status(
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> CredentialStatusResponse:
    """Check if Cronometer credentials exist for the current user.

    Args:
        current_user: The authenticated user.
        db: Database session.

    Returns:
        Credential status with last sync time.
    """
    result = await db.execute(
        select(CronometerCredential).where(CronometerCredential.user_id == current_user.id)
    )
    credential = result.scalar_one_or_none()

    return CredentialStatusResponse(
        has_credentials=credential is not None,
        last_sync_at=credential.last_sync_at if credential else None,
    )


@router.delete("/credentials", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credentials(
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete Cronometer credentials for the current user.

    Args:
        current_user: The authenticated user.
        db: Database session.

    Raises:
        HTTPException: 404 if no credentials exist.
    """
    result = await db.execute(
        select(CronometerCredential).where(CronometerCredential.user_id == current_user.id)
    )
    credential = result.scalar_one_or_none()

    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Cronometer credentials found",
        )

    await db.delete(credential)
    await db.flush()
    logger.info("Deleted Cronometer credentials", user_id=str(current_user.id))
