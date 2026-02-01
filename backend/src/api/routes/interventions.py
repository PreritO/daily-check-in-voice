"""Intervention tracking API endpoints."""

from datetime import date, datetime, timedelta
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_or_create_user
from src.api.schemas import (
    InterventionCreate,
    InterventionRead,
    InterventionUpdate,
    InterventionWithAnalysis,
)
from src.database import get_db
from src.models import HealthNote, Intervention, User

logger = structlog.get_logger()

router = APIRouter()


@router.post("", status_code=status.HTTP_201_CREATED, response_model=InterventionRead)
async def create_intervention(
    request: InterventionCreate,
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> Intervention:
    """Create a new dietary intervention."""
    intervention = Intervention(user_id=current_user.id, **request.model_dump())
    db.add(intervention)
    await db.flush()
    await db.refresh(intervention)

    logger.info(
        "Created intervention", intervention_id=str(intervention.id), user_id=str(current_user.id)
    )
    return intervention


@router.get("", response_model=list[InterventionRead])
async def list_interventions(
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> list[Intervention]:
    """List all interventions for current user."""
    result = await db.execute(
        select(Intervention)
        .where(Intervention.user_id == current_user.id)
        .order_by(Intervention.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{intervention_id}", response_model=InterventionWithAnalysis)
async def get_intervention(
    intervention_id: UUID,
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> InterventionWithAnalysis:
    """Get intervention with Bristol analysis if completed."""
    result = await db.execute(
        select(Intervention)
        .where(Intervention.id == intervention_id)
        .where(Intervention.user_id == current_user.id)
    )
    intervention = result.scalar_one_or_none()

    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention not found")

    # Calculate Bristol comparison
    analysis = await _calculate_bristol_analysis(db, intervention)

    return InterventionWithAnalysis(
        **{c.name: getattr(intervention, c.name) for c in intervention.__table__.columns},
        **analysis,
    )


@router.patch("/{intervention_id}", response_model=InterventionRead)
async def update_intervention(
    intervention_id: UUID,
    request: InterventionUpdate,
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> Intervention:
    """Update intervention status, notes, or end_date."""
    result = await db.execute(
        select(Intervention)
        .where(Intervention.id == intervention_id)
        .where(Intervention.user_id == current_user.id)
    )
    intervention = result.scalar_one_or_none()

    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention not found")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(intervention, field, value)

    await db.flush()
    await db.refresh(intervention)

    logger.info("Updated intervention", intervention_id=str(intervention_id))
    return intervention


@router.delete("/{intervention_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_intervention(
    intervention_id: UUID,
    current_user: User = Depends(get_or_create_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete an intervention."""
    result = await db.execute(
        select(Intervention)
        .where(Intervention.id == intervention_id)
        .where(Intervention.user_id == current_user.id)
    )
    intervention = result.scalar_one_or_none()

    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention not found")

    await db.delete(intervention)
    logger.info("Deleted intervention", intervention_id=str(intervention_id))


async def _calculate_bristol_analysis(db: AsyncSession, intervention: Intervention) -> dict:
    """Calculate Bristol comparison for an intervention."""
    # Default values
    result = {
        "avg_bristol_before": None,
        "avg_bristol_during": None,
        "bristol_difference": None,
        "days_before_analyzed": 0,
        "days_during_analyzed": 0,
    }

    # Get Bristol scores before intervention (14 days before start)
    before_start = datetime.combine(intervention.start_date, datetime.min.time())
    before_end = before_start  # Up to start date
    before_start = before_start - timedelta(days=14)

    before_query = await db.execute(
        select(func.avg(HealthNote.bristol_scale), func.count())
        .where(HealthNote.user_id == intervention.user_id)
        .where(HealthNote.is_bowel_movement == True)  # noqa: E712
        .where(HealthNote.bristol_scale.isnot(None))
        .where(HealthNote.logged_at >= before_start)
        .where(HealthNote.logged_at < before_end)
    )
    before_avg, before_count = before_query.one()

    if before_avg:
        result["avg_bristol_before"] = float(before_avg)
        result["days_before_analyzed"] = before_count

    # Get Bristol scores during intervention
    during_start = datetime.combine(intervention.start_date, datetime.min.time())
    during_end = datetime.combine(intervention.end_date or date.today(), datetime.max.time())

    during_query = await db.execute(
        select(func.avg(HealthNote.bristol_scale), func.count())
        .where(HealthNote.user_id == intervention.user_id)
        .where(HealthNote.is_bowel_movement == True)  # noqa: E712
        .where(HealthNote.bristol_scale.isnot(None))
        .where(HealthNote.logged_at >= during_start)
        .where(HealthNote.logged_at <= during_end)
    )
    during_avg, during_count = during_query.one()

    if during_avg:
        result["avg_bristol_during"] = float(during_avg)
        result["days_during_analyzed"] = during_count

    # Calculate difference
    if result["avg_bristol_before"] and result["avg_bristol_during"]:
        result["bristol_difference"] = result["avg_bristol_during"] - result["avg_bristol_before"]

    return result
