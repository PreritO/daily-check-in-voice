"""Agent tools definitions for OpenAI function calling.

This module defines the AGENT_TOOLS list containing function definitions
that the nutrition chat agent can use to query user health data.
"""

from openai.types.chat import ChatCompletionToolParam

# Tool 1: Get Food Logs
GET_FOOD_LOGS: ChatCompletionToolParam = {
    "type": "function",
    "function": {
        "name": "get_food_logs",
        "description": (
            "Retrieve food and meal logs for a specific date range. "
            "Returns food names, serving sizes, and nutritional data including "
            "calories, protein, carbs, fat, fiber, sugar, and sodium."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format (inclusive)",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format (inclusive)",
                },
                "food_group": {
                    "type": "string",
                    "description": (
                        "Optional filter by food group (e.g., 'Vegetables', 'Fruits', 'Grains')"
                    ),
                },
                "limit": {
                    "type": "integer",
                    "description": ("Maximum number of records to return (default 50, max 200)"),
                },
            },
            "required": ["start_date", "end_date"],
        },
    },
}

# Tool 2: Get Daily Nutrition Summary
GET_DAILY_NUTRITION_SUMMARY: ChatCompletionToolParam = {
    "type": "function",
    "function": {
        "name": "get_daily_nutrition_summary",
        "description": (
            "Get aggregated nutrition totals for a specific date. "
            "Returns total calories, macronutrients (protein, carbs, fat), "
            "fiber, sugar, sodium, and other tracked nutrients for the day."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "The date to summarize in YYYY-MM-DD format",
                },
                "include_detailed_nutrients": {
                    "type": "boolean",
                    "description": (
                        "If true, include all tracked nutrients "
                        "(vitamins, minerals, amino acids). "
                        "Default false for basic macros only."
                    ),
                },
            },
            "required": ["date"],
        },
    },
}

# Tool 3: Get Bowel Movements
GET_BOWEL_MOVEMENTS: ChatCompletionToolParam = {
    "type": "function",
    "function": {
        "name": "get_bowel_movements",
        "description": (
            "Retrieve bowel movement data including Bristol scale scores (1-7) "
            "and quantity scores for a date range. Bristol scale: 1-2 indicates "
            "constipation, 3-5 is healthy, 6-7 indicates diarrhea."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format (inclusive)",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format (inclusive)",
                },
                "include_notes": {
                    "type": "boolean",
                    "description": ("If true, include any associated notes. Default false."),
                },
            },
            "required": ["start_date", "end_date"],
        },
    },
}

# Tool 4: Get Exercises
GET_EXERCISES: ChatCompletionToolParam = {
    "type": "function",
    "function": {
        "name": "get_exercises",
        "description": (
            "Retrieve exercise and workout data for a date range. "
            "Returns exercise names, duration in minutes, and calories burned."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format (inclusive)",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format (inclusive)",
                },
                "exercise_type": {
                    "type": "string",
                    "description": ("Optional filter by exercise name/type (partial match)"),
                },
            },
            "required": ["start_date", "end_date"],
        },
    },
}

# Tool 5: Get Biometrics
GET_BIOMETRICS: ChatCompletionToolParam = {
    "type": "function",
    "function": {
        "name": "get_biometrics",
        "description": (
            "Retrieve biometric measurements for a date range. "
            "Includes weight, blood pressure, body fat percentage, and other "
            "health metrics the user has logged."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format (inclusive)",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format (inclusive)",
                },
                "metric_type": {
                    "type": "string",
                    "description": (
                        "Optional filter by metric type "
                        "(e.g., 'weight', 'blood_pressure', 'body_fat')"
                    ),
                },
            },
            "required": ["start_date", "end_date"],
        },
    },
}

# Tool 6: Get Health Notes
GET_HEALTH_NOTES: ChatCompletionToolParam = {
    "type": "function",
    "function": {
        "name": "get_health_notes",
        "description": (
            "Retrieve health notes and symptom logs for a date range. "
            "Excludes bowel movement entries (use get_bowel_movements for those). "
            "Returns timestamped notes about symptoms, feelings, or health observations."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format (inclusive)",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format (inclusive)",
                },
                "search_term": {
                    "type": "string",
                    "description": "Optional search term to filter notes by content",
                },
            },
            "required": ["start_date", "end_date"],
        },
    },
}

# Tool 7: Get Trigger Foods
GET_TRIGGER_FOODS: ChatCompletionToolParam = {
    "type": "function",
    "function": {
        "name": "get_trigger_foods",
        "description": (
            "Analyze which specific foods correlate with poor digestive outcomes "
            "(abnormal Bristol scores). Returns foods that appear to trigger "
            "constipation (Bristol 1-2) or diarrhea (Bristol 6-7) based on "
            "statistical correlation analysis."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": ("Start date in YYYY-MM-DD format for analysis period"),
                },
                "end_date": {
                    "type": "string",
                    "description": ("End date in YYYY-MM-DD format for analysis period"),
                },
                "min_occurrences": {
                    "type": "integer",
                    "description": (
                        "Minimum times a food must be eaten to be analyzed (default 3)"
                    ),
                },
                "time_lag_hours": {
                    "type": "integer",
                    "description": ("Hours after eating to look for Bristol events (default 24)"),
                },
            },
            "required": ["start_date", "end_date"],
        },
    },
}

# Tool 8: Get Nutrient Correlations
GET_NUTRIENT_CORRELATIONS: ChatCompletionToolParam = {
    "type": "function",
    "function": {
        "name": "get_nutrient_correlations",
        "description": (
            "Find correlations between nutrient intake and digestive outcomes "
            "(Bristol scale scores). Analyzes multiple time windows "
            "(12h, 24h, 36h, 48h, 72h) to identify which nutrients consistently "
            "affect bowel movements. Returns statistically significant "
            "correlations with interpretation."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": ("Start date in YYYY-MM-DD format for analysis period"),
                },
                "end_date": {
                    "type": "string",
                    "description": ("End date in YYYY-MM-DD format for analysis period"),
                },
                "analysis_level": {
                    "type": "string",
                    "enum": ["basic", "standard", "comprehensive"],
                    "description": (
                        "Level of detail: 'basic' (macros only), "
                        "'standard' (macros + vitamins/minerals), "
                        "'comprehensive' (all 50+ nutrients). Default 'standard'."
                    ),
                },
                "nutrient_filter": {
                    "type": "string",
                    "description": (
                        "Optional specific nutrient to analyze "
                        "(e.g., 'Fiber', 'Caffeine', 'Sodium')"
                    ),
                },
            },
            "required": ["start_date", "end_date"],
        },
    },
}

# Tool 9: Compare Days
COMPARE_DAYS: ChatCompletionToolParam = {
    "type": "function",
    "function": {
        "name": "compare_days",
        "description": (
            "Compare nutrition and digestive outcomes between two time periods "
            "or between 'good' and 'bad' digestive days. Useful for identifying "
            "what dietary differences exist between days with healthy vs unhealthy "
            "Bristol scores."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "period1_start": {
                    "type": "string",
                    "description": "Start date of first period in YYYY-MM-DD format",
                },
                "period1_end": {
                    "type": "string",
                    "description": "End date of first period in YYYY-MM-DD format",
                },
                "period2_start": {
                    "type": "string",
                    "description": "Start date of second period in YYYY-MM-DD format",
                },
                "period2_end": {
                    "type": "string",
                    "description": "End date of second period in YYYY-MM-DD format",
                },
                "compare_mode": {
                    "type": "string",
                    "enum": ["periods", "good_vs_bad_days"],
                    "description": (
                        "'periods' compares the two date ranges directly. "
                        "'good_vs_bad_days' ignores period2 and compares days "
                        "with Bristol 3-5 vs days with Bristol <3 or >5 within period1."
                    ),
                },
                "metrics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "List of metrics to compare "
                        "(e.g., ['calories', 'fiber_g', 'protein_g']). "
                        "Default compares all macros."
                    ),
                },
            },
            "required": ["period1_start", "period1_end"],
        },
    },
}


# Complete list of all agent tools
AGENT_TOOLS: list[ChatCompletionToolParam] = [
    GET_FOOD_LOGS,
    GET_DAILY_NUTRITION_SUMMARY,
    GET_BOWEL_MOVEMENTS,
    GET_EXERCISES,
    GET_BIOMETRICS,
    GET_HEALTH_NOTES,
    GET_TRIGGER_FOODS,
    GET_NUTRIENT_CORRELATIONS,
    COMPARE_DAYS,
]


# Tool name to function mapping (for executor lookup)
TOOL_NAMES: dict[str, str] = {
    "get_food_logs": "get_food_logs",
    "get_daily_nutrition_summary": "get_daily_nutrition_summary",
    "get_bowel_movements": "get_bowel_movements",
    "get_exercises": "get_exercises",
    "get_biometrics": "get_biometrics",
    "get_health_notes": "get_health_notes",
    "get_trigger_foods": "get_trigger_foods",
    "get_nutrient_correlations": "get_nutrient_correlations",
    "compare_days": "compare_days",
}
