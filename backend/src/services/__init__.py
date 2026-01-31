"""Business logic services."""

from .analytics_service import MoodTrendItem, UserAnalytics, get_user_analytics
from .auth_service import AuthError, TokenPayload, verify_supabase_token
from .comparison_service import (
    ComparisonResult,
    ControlledComparisonService,
    InsufficientMatchesError,
)
from .food_correlation_service import (
    FoodAnalysisResponse,
    FoodCorrelationResult,
    FoodCorrelationService,
)
from .food_correlation_service import (
    InsufficientDataError as FoodInsufficientDataError,
)
from .granger_service import (
    GrangerCausalityService,
    GrangerResult,
)
from .granger_service import (
    InsufficientDataError as GrangerInsufficientDataError,
)
from .insights_service import (
    NUTRIENT_GROUPS,
    TRACKED_NUTRIENTS,
    ConsistentCorrelation,
    CorrelationResult,
    InsightsService,
    InsufficientDataError,
    MultiLagCorrelationResponse,
    TimeLagWindow,
)
from .livekit_service import RoomInfo, create_room_for_call, dispatch_agent_to_room
from .memory_service import (
    ExtractedMemory,
    MemoryExtractionResult,
    extract_memories,
    get_user_context,
)
from .mood_service import MoodAnalysisResult, analyze_mood
from .post_call_service import PostCallResult, process_completed_call
from .scheduler_service import (
    add_schedule_job,
    get_scheduler,
    remove_schedule_job,
    shutdown_scheduler,
    start_scheduler,
)
from .slack_service import SlackPostResult, post_summary
from .summary_service import StandupSummary, generate_summary

__all__ = [
    "AuthError",
    "ComparisonResult",
    "ConsistentCorrelation",
    "ControlledComparisonService",
    "CorrelationResult",
    "ExtractedMemory",
    "FoodAnalysisResponse",
    "FoodCorrelationResult",
    "FoodCorrelationService",
    "FoodInsufficientDataError",
    "GrangerCausalityService",
    "GrangerInsufficientDataError",
    "GrangerResult",
    "InsightsService",
    "InsufficientDataError",
    "InsufficientMatchesError",
    "MemoryExtractionResult",
    "MoodAnalysisResult",
    "MoodTrendItem",
    "MultiLagCorrelationResponse",
    "NUTRIENT_GROUPS",
    "PostCallResult",
    "RoomInfo",
    "SlackPostResult",
    "StandupSummary",
    "TimeLagWindow",
    "TokenPayload",
    "TRACKED_NUTRIENTS",
    "UserAnalytics",
    "add_schedule_job",
    "analyze_mood",
    "create_room_for_call",
    "dispatch_agent_to_room",
    "extract_memories",
    "generate_summary",
    "get_scheduler",
    "get_user_analytics",
    "get_user_context",
    "post_summary",
    "process_completed_call",
    "remove_schedule_job",
    "shutdown_scheduler",
    "start_scheduler",
    "verify_supabase_token",
]

# Services to be implemented:
# from .call_service import CallService
# from .notion_service import NotionService
