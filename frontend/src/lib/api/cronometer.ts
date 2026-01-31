import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

// =============================================================================
// Types
// =============================================================================

export interface CredentialStatus {
  has_credentials: boolean;
  last_sync_at: string | null;
}

export interface SaveCredentialsRequest {
  email: string;
  password: string;
}

export interface SyncRequest {
  days_back?: number;
}

export interface SyncResponse {
  food_logs_synced: number;
  biometric_logs_synced: number;
  health_notes_synced: number;
  synced_at: string;
}

export interface FoodLog {
  id: string;
  user_id: string;
  logged_at: string;
  food_name: string;
  serving_size: string;
  food_group: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  created_at: string;
}

export interface HealthNote {
  id: string;
  user_id: string;
  logged_at: string;
  content: string;
  is_bowel_movement: boolean;
  bristol_scale: number | null;
  quantity_score: number | null;
  created_at: string;
}

export interface CorrelationResult {
  nutrient_name: string;
  nutrient_key: string;
  time_lag_hours: number;
  correlation_coefficient: number;
  p_value: number;
  sample_size: number;
  is_significant: boolean;
  avg_bristol_high_intake: number | null;
  avg_bristol_low_intake: number | null;
  intake_high_threshold: number | null;
  intake_low_threshold: number | null;
  direction: string;
}

export interface ConsistentCorrelation {
  nutrient_name: string;
  nutrient_key: string;
  windows_significant: number;
  avg_correlation: number;
  direction: string;
}

export interface MultiLagCorrelationResponse {
  baseline_bristol_score: number;
  total_bowel_movements: number;
  total_food_logs: number;
  analysis_start_date: string;
  analysis_end_date: string;
  results_by_lag: Record<number, CorrelationResult[]>;
  consistent_correlations: ConsistentCorrelation[];
  insights: string[];
}

export type TimeLag = 12 | 24 | 36 | 48 | 72;
export type AnalysisLevel = "basic" | "standard" | "comprehensive";

export interface CorrelationsParams {
  startDate: string;
  endDate: string;
  timeLags?: TimeLag[];
  minSampleSize?: number;
  analysisLevel?: AnalysisLevel;
}

// =============================================================================
// API Functions
// =============================================================================

async function getCredentialStatus(): Promise<CredentialStatus> {
  const response = await apiClient.get<CredentialStatus>("/cronometer/credentials/status");
  return response.data;
}

async function saveCredentials(request: SaveCredentialsRequest): Promise<CredentialStatus> {
  const response = await apiClient.post<CredentialStatus>("/cronometer/credentials", request);
  return response.data;
}

async function deleteCredentials(): Promise<void> {
  await apiClient.delete("/cronometer/credentials");
}

async function syncCronometer(request: SyncRequest = {}): Promise<SyncResponse> {
  const response = await apiClient.post<SyncResponse>("/cronometer/sync", request);
  return response.data;
}

interface GetFoodLogsParams {
  startDate: string;
  endDate: string;
}

async function getFoodLogs(params: GetFoodLogsParams): Promise<FoodLog[]> {
  const queryParams = new URLSearchParams();
  queryParams.set("start_date", params.startDate);
  queryParams.set("end_date", params.endDate);

  const response = await apiClient.get<FoodLog[]>(`/cronometer/food-logs?${queryParams}`);
  return response.data;
}

interface GetHealthNotesParams {
  startDate: string;
  endDate: string;
}

async function getHealthNotes(params: GetHealthNotesParams): Promise<HealthNote[]> {
  const queryParams = new URLSearchParams();
  queryParams.set("start_date", params.startDate);
  queryParams.set("end_date", params.endDate);

  const response = await apiClient.get<HealthNote[]>(`/cronometer/health-notes?${queryParams}`);
  return response.data;
}

async function getCorrelations(params: CorrelationsParams): Promise<MultiLagCorrelationResponse> {
  const queryParams = new URLSearchParams();
  queryParams.set("start_date", params.startDate);
  queryParams.set("end_date", params.endDate);

  // Handle time_lags as multiple query params
  const timeLags = params.timeLags ?? [12, 24, 36, 48, 72];
  for (const lag of timeLags) {
    queryParams.append("time_lags", String(lag));
  }

  if (params.minSampleSize !== undefined) {
    queryParams.set("min_sample_size", String(params.minSampleSize));
  }

  if (params.analysisLevel !== undefined) {
    queryParams.set("analysis_level", params.analysisLevel);
  }

  const response = await apiClient.get<MultiLagCorrelationResponse>(
    `/cronometer/insights/correlations?${queryParams}`
  );
  return response.data;
}

// =============================================================================
// React Query Hooks
// =============================================================================

export const cronometerKeys = {
  all: ["cronometer"] as const,
  status: () => [...cronometerKeys.all, "status"] as const,
  foodLogs: () => [...cronometerKeys.all, "food-logs"] as const,
  foodLogsByDate: (startDate: string, endDate: string) =>
    [...cronometerKeys.foodLogs(), { startDate, endDate }] as const,
  healthNotes: () => [...cronometerKeys.all, "health-notes"] as const,
  healthNotesByDate: (startDate: string, endDate: string) =>
    [...cronometerKeys.healthNotes(), { startDate, endDate }] as const,
  insights: () => [...cronometerKeys.all, "insights"] as const,
  correlations: (params: CorrelationsParams) =>
    [...cronometerKeys.insights(), "correlations", params] as const,
};

export function useCronometerStatusQuery() {
  return useQuery({
    queryKey: cronometerKeys.status(),
    queryFn: getCredentialStatus,
  });
}

export function useSaveCronometerCredentialsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveCredentials,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cronometerKeys.status() });
    },
  });
}

export function useDeleteCronometerCredentialsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCredentials,
    onSuccess: () => {
      // Invalidate all cronometer data since credentials are gone
      queryClient.invalidateQueries({ queryKey: cronometerKeys.all });
    },
  });
}

export function useSyncCronometerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncCronometer,
    onSuccess: () => {
      // Invalidate status to refresh last_sync_at
      queryClient.invalidateQueries({ queryKey: cronometerKeys.status() });
      // Invalidate food logs and health notes since new data may have been synced
      queryClient.invalidateQueries({ queryKey: cronometerKeys.foodLogs() });
      queryClient.invalidateQueries({ queryKey: cronometerKeys.healthNotes() });
      // Invalidate insights since underlying data changed
      queryClient.invalidateQueries({ queryKey: cronometerKeys.insights() });
    },
  });
}

export function useFoodLogsQuery(startDate: string, endDate: string) {
  return useQuery({
    queryKey: cronometerKeys.foodLogsByDate(startDate, endDate),
    queryFn: () => getFoodLogs({ startDate, endDate }),
    enabled: !!startDate && !!endDate,
  });
}

export function useHealthNotesQuery(startDate: string, endDate: string) {
  return useQuery({
    queryKey: cronometerKeys.healthNotesByDate(startDate, endDate),
    queryFn: () => getHealthNotes({ startDate, endDate }),
    enabled: !!startDate && !!endDate,
  });
}

export function useCorrelationsQuery(params: CorrelationsParams) {
  return useQuery({
    queryKey: cronometerKeys.correlations(params),
    queryFn: () => getCorrelations(params),
    enabled: !!params.startDate && !!params.endDate,
  });
}
