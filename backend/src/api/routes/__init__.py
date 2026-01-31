"""API route modules."""

from fastapi import APIRouter

from .alerts import router as alerts_router
from .calls import router as calls_router
from .cronometer import router as cronometer_router
from .health import router as health_router
from .preferences import router as preferences_router
from .schedules import router as schedules_router
from .summaries import router as summaries_router
from .users import router as users_router
from .webhooks import router as webhooks_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["health"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(calls_router, prefix="/calls", tags=["calls"])
api_router.include_router(schedules_router, prefix="/schedules", tags=["schedules"])
api_router.include_router(summaries_router, prefix="/summaries", tags=["summaries"])
api_router.include_router(preferences_router, prefix="/preferences", tags=["preferences"])
api_router.include_router(webhooks_router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(alerts_router, prefix="/alerts", tags=["alerts"])
api_router.include_router(cronometer_router, prefix="/cronometer", tags=["cronometer"])
