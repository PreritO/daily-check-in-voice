"""Cronometer integration API endpoints."""

from datetime import UTC, date, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pycronometer.exceptions import CronometerAuthError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_or_create_user
from src.api.schemas import (
    CredentialStatusResponse,
    FoodLogResponse,
    HealthNoteResponse,
    SaveCredentialsRequest,
    SyncRequest,
    SyncResponse,
)
from src.database import get_db
from src.integrations.cronometer import CronometerSyncService
from src.models import CronometerCredential, FoodLog, HealthNote, User
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


@router.get("/food-logs", response_model=list[FoodLogResponse])
async def get_food_logs(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> list[FoodLog]:
    """Get food logs for the current user within a date range.

    Args:
        start_date: Start date (inclusive).
        end_date: End date (inclusive).
        current_user: The authenticated user.
        db: Database session.

    Returns:
        List of food logs, ordered by logged_at descending.
    """
    # Convert dates to datetimes for comparison
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    result = await db.execute(
        select(FoodLog)
        .where(FoodLog.user_id == current_user.id)
        .where(FoodLog.logged_at >= start_dt)
        .where(FoodLog.logged_at <= end_dt)
        .order_by(FoodLog.logged_at.desc())
    )
    return list(result.scalars().all())


@router.get("/health-notes", response_model=list[HealthNoteResponse])
async def get_health_notes(
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> list[HealthNote]:
    """Get health notes for the current user within a date range.

    Args:
        start_date: Start date (inclusive).
        end_date: End date (inclusive).
        current_user: The authenticated user.
        db: Database session.

    Returns:
        List of health notes, ordered by logged_at descending.
    """
    # Convert dates to datetimes for comparison
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    result = await db.execute(
        select(HealthNote)
        .where(HealthNote.user_id == current_user.id)
        .where(HealthNote.logged_at >= start_dt)
        .where(HealthNote.logged_at <= end_dt)
        .order_by(HealthNote.logged_at.desc())
    )
    return list(result.scalars().all())
