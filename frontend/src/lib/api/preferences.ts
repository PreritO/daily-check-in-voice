import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

// =============================================================================
// Types
// =============================================================================

export type CommunicationStyle = "casual" | "formal" | "friendly";
export type CallDurationPreference = "short" | "medium" | "long";
export type ThemeMode = "light" | "dark" | "system";

export interface UserPreferences {
  id: string;
  user_id: string;
  conversation_topics: string[];
  interests: string[];
  communication_style: CommunicationStyle;
  call_duration_preference: CallDurationPreference;
  theme_mode: ThemeMode;
  created_at: string;
  updated_at: string;
}

export interface UpdatePreferencesParams {
  conversation_topics?: string[];
  interests?: string[];
  communication_style?: CommunicationStyle;
  call_duration_preference?: CallDurationPreference;
  theme_mode?: ThemeMode;
}

// =============================================================================
// API Functions
// =============================================================================

export async function getPreferences(): Promise<UserPreferences> {
  const response = await apiClient.get<UserPreferences>("/preferences");
  return response.data;
}

export async function updatePreferences(
  params: UpdatePreferencesParams
): Promise<UserPreferences> {
  const response = await apiClient.put<UserPreferences>("/preferences", params);
  return response.data;
}

// =============================================================================
// React Query Hooks
// =============================================================================

export const preferencesKeys = {
  all: ["preferences"] as const,
  me: () => [...preferencesKeys.all, "me"] as const,
};

export function usePreferencesQuery() {
  return useQuery({
    queryKey: preferencesKeys.me(),
    queryFn: getPreferences,
  });
}

export function useUpdatePreferencesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(preferencesKeys.me(), data);
    },
  });
}
