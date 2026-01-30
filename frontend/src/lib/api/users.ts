import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

// =============================================================================
// Types
// =============================================================================

export interface User {
  id: string;
  auth_id: string | null;
  email: string;
  name: string;
  timezone: string;
  phone_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateUserParams {
  name?: string;
  timezone?: string;
  phone_number?: string | null;
  email?: string;
}

// =============================================================================
// API Functions
// =============================================================================

export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>("/users/me");
  return response.data;
}

export async function updateCurrentUser(params: UpdateUserParams): Promise<User> {
  const response = await apiClient.patch<User>("/users/me", params);
  return response.data;
}

// =============================================================================
// React Query Hooks
// =============================================================================

export const userKeys = {
  all: ["user"] as const,
  me: () => [...userKeys.all, "me"] as const,
};

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: getCurrentUser,
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCurrentUser,
    onSuccess: (data) => {
      queryClient.setQueryData(userKeys.me(), data);
    },
  });
}

// =============================================================================
// Delete User
// =============================================================================

export async function deleteUser(userId: string): Promise<void> {
  await apiClient.delete(`/users/${userId}`);
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      // Clear user data from cache
      queryClient.removeQueries({ queryKey: userKeys.all });
    },
  });
}

// =============================================================================
// Phone Validation Helper
// =============================================================================

/**
 * Validate phone number in E.164 format.
 * E.164 format: +[country code][number] e.g., +12025551234
 * - Optional + prefix
 * - 10-15 digits total
 */
export function isValidE164Phone(phone: string): boolean {
  const pattern = /^\+?[0-9]{10,15}$/;
  return pattern.test(phone);
}

/**
 * Format phone number to E.164 format by adding + prefix if missing.
 */
export function formatToE164(phone: string): string {
  // Keep only digits
  const digitsOnly = phone.replace(/\D/g, "");
  // Always add + prefix since we stripped it
  return `+${digitsOnly}`;
}

// =============================================================================
// Memory Types and API
// =============================================================================

export type UserMemoryType = "fact" | "preference" | "event" | "relationship";

export interface UserMemory {
  id: string;
  user_id: string;
  memory_type: UserMemoryType;
  content: string;
  source_call_id: string | null;
  importance: number;
  created_at: string;
}

export const memoriesKeys = {
  all: ["memories"] as const,
  user: (limit?: number) => [...memoriesKeys.all, "user", limit] as const,
};

async function getUserMemories(limit: number = 3): Promise<UserMemory[]> {
  const response = await apiClient.get<UserMemory[]>(`/users/me/memories?limit=${limit}`);
  return response.data;
}

export function useUserMemoriesQuery(limit: number = 3) {
  return useQuery({
    queryKey: memoriesKeys.user(limit),
    queryFn: () => getUserMemories(limit),
  });
}
