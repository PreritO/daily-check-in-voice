"""API route modules."""

from fastapi import APIRouter

from .health import router as health_router
from .users import router as users_router

# Import routers as they are created:
# from .calls import router as calls_router
# from .schedules import router as schedules_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["health"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
# api_router.include_router(calls_router, prefix="/calls", tags=["calls"])
# api_router.include_router(schedules_router, prefix="/schedules", tags=["schedules"])
