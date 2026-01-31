"""Cronometer integration API endpoints."""

from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pycronometer.exceptions import CronometerAuthError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_or_create_user
from src.api.schemas import (
    CredentialStatusResponse,
    SaveCredentialsRequest,
    SyncRequest,
    SyncResponse,
)
from src.database import get_db
from src.integrations.cronometer import CronometerSyncService
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


@router.post("/sync", response_model=SyncResponse)
async def sync_cronometer_data(
    request: SyncRequest = SyncRequest(),
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> SyncResponse:
    """Trigger a manual Cronometer sync for the current user.

    Args:
        request: Sync parameters (days_back, default 7, max 90).
        current_user: The authenticated user.
        db: Database session.

    Returns:
        Sync result with counts and timestamp.

    Raises:
        HTTPException: 404 if no credentials saved, 401 if Cronometer login fails.
    """
    # Check if credentials exist
    result = await db.execute(
        select(CronometerCredential).where(CronometerCredential.user_id == current_user.id)
    )
    credential = result.scalar_one_or_none()

    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Cronometer credentials found. Please save credentials first.",
        )

    # Run sync
    sync_service = CronometerSyncService(db)
    try:
        sync_result = await sync_service.sync_user(current_user.id, request.days_back)
    except CronometerAuthError as e:
        logger.warning(
            "Cronometer login failed",
            user_id=str(current_user.id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cronometer login failed. Please check your credentials.",
        ) from e

    logger.info(
        "Cronometer sync completed",
        user_id=str(current_user.id),
        food_logs=sync_result.food_logs_synced,
        biometric_logs=sync_result.biometric_logs_synced,
        health_notes=sync_result.health_notes_synced,
    )

    return SyncResponse(
        food_logs_synced=sync_result.food_logs_synced,
        biometric_logs_synced=sync_result.biometric_logs_synced,
        health_notes_synced=sync_result.health_notes_synced,
        synced_at=datetime.now(UTC),
    )
