"""FastAPI application entry point."""

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import api_router
from .config import get_settings
from .services.scheduler_service import shutdown_scheduler, start_scheduler

settings = get_settings()

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
        if not settings.is_development
        else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

app = FastAPI(
    title="Daily Check-In Agent API",
    description="Voice-driven daily standup bot API",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")


@app.on_event("startup")
async def startup_event() -> None:
    """Run on application startup."""
    logger.info("Starting Daily Check-In Agent API", env=settings.APP_ENV)

    # Initialize and start the scheduler
    try:
        await start_scheduler()
        logger.info("Scheduler started successfully")
    except Exception as e:
        logger.exception("Failed to start scheduler", error=str(e))


@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Run on application shutdown."""
    logger.info("Shutting down Daily Check-In Agent API")

    # Gracefully shutdown the scheduler
    try:
        await shutdown_scheduler()
        logger.info("Scheduler shutdown successfully")
    except Exception as e:
        logger.exception("Error shutting down scheduler", error=str(e))
