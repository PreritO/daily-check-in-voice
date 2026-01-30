import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

// =============================================================================
// Types
// =============================================================================

export type Sentiment = "positive" | "neutral" | "negative" | "concerned";

export interface MoodTrendItem {
  call_date: string; // ISO date
  sentiment: Sentiment;
  confidence: number; // 0-1
}

export interface UserAnalytics {
  total_calls: number;
  total_duration_minutes: number;
  average_call_duration: number; // in minutes
  calls_this_week: number;
  calls_this_month: number;
  mood_trend: MoodTrendItem[];
  streak_days: number;
}

// =============================================================================
// API Functions
// =============================================================================

async function getAnalytics(): Promise<UserAnalytics> {
  const response = await apiClient.get<UserAnalytics>("/users/me/analytics");
  return response.data;
}

// =============================================================================
// React Query Hooks
// =============================================================================

export const analyticsKeys = {
  all: ["analytics"] as const,
  user: () => [...analyticsKeys.all, "user"] as const,
};

export function useAnalyticsQuery() {
  return useQuery({
    queryKey: analyticsKeys.user(),
    queryFn: getAnalytics,
  });
}
