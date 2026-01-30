"""Alert API endpoints."""

from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_or_create_user
from src.api.schemas import AlertRead
from src.database import get_db
from src.models import Alert, User
from src.services.alert_service import acknowledge_alert, get_all_alerts, get_unacknowledged_alerts

logger = structlog.get_logger()

router = APIRouter()


@router.get("/", response_model=list[AlertRead])
async def list_alerts(
    acknowledged: bool | None = Query(
        default=None,
        description="Filter by acknowledgement status. If None, returns all alerts.",
    ),
    limit: int = Query(default=50, ge=1, le=100, description="Maximum number of alerts to return"),
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> list[Alert]:
    """Get alerts for the current user.

    Args:
        acknowledged: Optional filter for acknowledgement status.
        limit: Maximum number of alerts to return.
        current_user: The authenticated user from the JWT token.
        db: Database session.

    Returns:
        List of alerts for the current user.
    """
    logger.info(
        "listing_alerts", user_id=str(current_user.id), acknowledged=acknowledged, limit=limit
    )

    if acknowledged is None:
        # Return all alerts
        alerts = await get_all_alerts(user_id=current_user.id, db=db, limit=limit)
    elif acknowledged is False:
        # Return only unacknowledged
        alerts = await get_unacknowledged_alerts(user_id=current_user.id, db=db, limit=limit)
    else:
        # acknowledged=True - for now, get all and filter (could optimize with dedicated function)
        all_alerts = await get_all_alerts(user_id=current_user.id, db=db, limit=limit * 2)
        alerts = [a for a in all_alerts if a.acknowledged][:limit]

    logger.info("alerts_listed", user_id=str(current_user.id), count=len(alerts))
    return alerts


@router.post("/{alert_id}/acknowledge", response_model=AlertRead)
async def acknowledge_user_alert(
    alert_id: UUID,
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> Alert:
    """Acknowledge an alert.

    Args:
        alert_id: UUID of the alert to acknowledge.
        current_user: The authenticated user from the JWT token.
        db: Database session.

    Returns:
        The updated alert.

    Raises:
        HTTPException: 404 if alert not found or doesn't belong to user.
    """
    logger.info("acknowledging_alert", alert_id=str(alert_id), user_id=str(current_user.id))

    alert = await acknowledge_alert(
        alert_id=alert_id,
        user_id=current_user.id,
        db=db,
    )

    if alert is None:
        logger.warning("alert_not_found", alert_id=str(alert_id), user_id=str(current_user.id))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with id {alert_id} not found",
        )

    await db.commit()
    logger.info("alert_acknowledged", alert_id=str(alert_id), user_id=str(current_user.id))
    return alert
