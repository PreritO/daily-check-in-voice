import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

// =============================================================================
// Types
// =============================================================================

export type CallStatus = "scheduled" | "in_progress" | "completed" | "failed";
export type Speaker = "agent" | "user";

export interface Call {
  id: string;
  user_id: string;
  status: CallStatus;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transcript {
  id: string;
  call_id: string;
  speaker: Speaker;
  content: string;
  timestamp_ms: number;
  created_at: string;
}

export interface Summary {
  id: string;
  call_id: string;
  yesterday: string;
  today: string;
  blockers: string | null;
  raw_summary: string;
  posted_to_slack: boolean;
  slack_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallWithDetails extends Call {
  transcripts: Transcript[];
  summary: Summary | null;
}

// =============================================================================
// API Functions
// =============================================================================

interface GetCallsParams {
  userId?: string;
  skip?: number;
  limit?: number;
}

async function getCalls(params: GetCallsParams = {}): Promise<Call[]> {
  const { userId, skip = 0, limit = 100 } = params;
  const queryParams = new URLSearchParams();
  if (userId) queryParams.set("user_id", userId);
  queryParams.set("skip", String(skip));
  queryParams.set("limit", String(limit));

  const response = await apiClient.get<Call[]>(`/calls/?${queryParams}`);
  return response.data;
}

async function getCall(id: string): Promise<CallWithDetails> {
  const response = await apiClient.get<CallWithDetails>(`/calls/${id}`);
  return response.data;
}

interface CreateCallParams {
  user_id: string;
  scheduled_at?: string | null;
  status?: CallStatus;
}

async function createCall(params: CreateCallParams): Promise<Call> {
  const response = await apiClient.post<Call>("/calls/", params);
  return response.data;
}

interface UpdateCallParams {
  id: string;
  status?: CallStatus;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
}

async function updateCall({ id, ...data }: UpdateCallParams): Promise<Call> {
  const response = await apiClient.patch<Call>(`/calls/${id}`, data);
  return response.data;
}

async function deleteCall(id: string): Promise<void> {
  await apiClient.delete(`/calls/${id}`);
}

// =============================================================================
// React Query Hooks
// =============================================================================

export const callsKeys = {
  all: ["calls"] as const,
  lists: () => [...callsKeys.all, "list"] as const,
  list: (params: GetCallsParams) => [...callsKeys.lists(), params] as const,
  details: () => [...callsKeys.all, "detail"] as const,
  detail: (id: string) => [...callsKeys.details(), id] as const,
};

export function useCallsQuery(params: GetCallsParams = {}) {
  return useQuery({
    queryKey: callsKeys.list(params),
    queryFn: () => getCalls(params),
  });
}

export function useCallQuery(id: string) {
  return useQuery({
    queryKey: callsKeys.detail(id),
    queryFn: () => getCall(id),
    enabled: !!id,
  });
}

export function useCreateCallMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCall,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: callsKeys.lists() });
    },
  });
}

export function useUpdateCallMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCall,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: callsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: callsKeys.detail(data.id) });
    },
  });
}

export function useDeleteCallMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCall,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: callsKeys.lists() });
    },
  });
}

// =============================================================================
// Call Trigger API
// =============================================================================

export interface TriggerCallResponse {
  call_id: string;
  room_name: string;
  token: string;
  livekit_url: string;
}

interface TriggerCallParams {
  user_id: string;
}

async function triggerCall(params: TriggerCallParams): Promise<TriggerCallResponse> {
  const response = await apiClient.post<TriggerCallResponse>("/calls/trigger", params);
  return response.data;
}

export function useTriggerCallMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerCall,
    onSuccess: () => {
      // Invalidate calls list to show the new in-progress call
      queryClient.invalidateQueries({ queryKey: callsKeys.lists() });
    },
  });
}

// =============================================================================
// Summary-related API Functions
// =============================================================================

async function postSummaryToSlack(summaryId: string): Promise<Summary> {
  const response = await apiClient.post<Summary>(`/summaries/${summaryId}/post-to-slack`);
  return response.data;
}

export function usePostToSlackMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postSummaryToSlack,
    onSuccess: (data) => {
      // Invalidate the call detail query to refresh the summary
      queryClient.invalidateQueries({ queryKey: callsKeys.detail(data.call_id) });
    },
  });
}
