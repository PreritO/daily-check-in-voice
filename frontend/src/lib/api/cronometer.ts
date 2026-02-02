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
  exercises_synced: number;
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

export interface ExerciseLog {
  id: string;
  user_id: string;
  logged_at: string;
  name: string;
  duration_minutes: number | null;
  calories_burned: number | null;
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

interface GetExerciseLogsParams {
  startDate: string;
  endDate: string;
}

async function getExerciseLogs(params: GetExerciseLogsParams): Promise<ExerciseLog[]> {
  const queryParams = new URLSearchParams();
  queryParams.set("start_date", params.startDate);
  queryParams.set("end_date", params.endDate);

  const response = await apiClient.get<ExerciseLog[]>(`/cronometer/exercises?${queryParams}`);
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
  exerciseLogs: () => [...cronometerKeys.all, "exercise-logs"] as const,
  exerciseLogsByDate: (startDate: string, endDate: string) =>
    [...cronometerKeys.exerciseLogs(), { startDate, endDate }] as const,
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
      // Invalidate food logs, health notes, and exercise logs since new data may have been synced
      queryClient.invalidateQueries({ queryKey: cronometerKeys.foodLogs() });
      queryClient.invalidateQueries({ queryKey: cronometerKeys.healthNotes() });
      queryClient.invalidateQueries({ queryKey: cronometerKeys.exerciseLogs() });
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

export function useExerciseLogsQuery(startDate: string, endDate: string) {
  return useQuery({
    queryKey: cronometerKeys.exerciseLogsByDate(startDate, endDate),
    queryFn: () => getExerciseLogs({ startDate, endDate }),
    enabled: !!startDate && !!endDate,
  });
}

export function useCorrelationsQuery(params: CorrelationsParams, enabled: boolean = true) {
  return useQuery({
    queryKey: cronometerKeys.correlations(params),
    queryFn: () => getCorrelations(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}

// =============================================================================
// Intervention Types
// =============================================================================

export type InterventionStatus = "planned" | "active" | "completed" | "cancelled";

export interface Intervention {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  hypothesis: string | null;
  nutrient_key: string | null;
  target_value: number | null;
  start_date: string;
  end_date: string | null;
  status: InterventionStatus;
  outcome_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InterventionWithAnalysis extends Intervention {
  avg_bristol_before: number | null;
  avg_bristol_during: number | null;
  bristol_difference: number | null;
  days_before_analyzed: number;
  days_during_analyzed: number;
}

export interface InterventionCreate {
  title: string;
  description?: string | null;
  hypothesis?: string | null;
  nutrient_key?: string | null;
  target_value?: number | null;
  start_date: string;
  end_date?: string | null;
  status?: InterventionStatus;
}

export interface InterventionUpdate {
  title?: string;
  description?: string | null;
  hypothesis?: string | null;
  nutrient_key?: string | null;
  target_value?: number | null;
  end_date?: string | null;
  status?: InterventionStatus;
  outcome_notes?: string | null;
}

// =============================================================================
// Intervention Query Keys
// =============================================================================

export const interventionKeys = {
  all: ["interventions"] as const,
  lists: () => [...interventionKeys.all, "list"] as const,
  list: (status?: InterventionStatus) => [...interventionKeys.lists(), { status }] as const,
  details: () => [...interventionKeys.all, "detail"] as const,
  detail: (id: string) => [...interventionKeys.details(), id] as const,
};

// =============================================================================
// Intervention API Functions
// =============================================================================

async function getInterventions(status?: InterventionStatus): Promise<Intervention[]> {
  const params = new URLSearchParams();
  if (status) {
    params.append("status", status);
  }
  const queryString = params.toString();
  const url = queryString ? `/interventions?${queryString}` : "/interventions";
  const response = await apiClient.get(url);
  return response.data;
}

async function getIntervention(id: string): Promise<InterventionWithAnalysis> {
  const response = await apiClient.get(`/interventions/${id}`);
  return response.data;
}

async function createIntervention(data: InterventionCreate): Promise<Intervention> {
  const response = await apiClient.post("/interventions", data);
  return response.data;
}

async function updateIntervention(id: string, data: InterventionUpdate): Promise<Intervention> {
  const response = await apiClient.patch(`/interventions/${id}`, data);
  return response.data;
}

async function deleteIntervention(id: string): Promise<void> {
  await apiClient.delete(`/interventions/${id}`);
}

// =============================================================================
// Intervention Hooks
// =============================================================================

export function useInterventionsQuery(status?: InterventionStatus) {
  return useQuery({
    queryKey: interventionKeys.list(status),
    queryFn: () => getInterventions(status),
  });
}

export function useInterventionQuery(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: interventionKeys.detail(id),
    queryFn: () => getIntervention(id),
    enabled: enabled && !!id,
  });
}

export function useCreateInterventionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createIntervention,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interventionKeys.lists() });
    },
  });
}

export function useUpdateInterventionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: InterventionUpdate }) =>
      updateIntervention(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: interventionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(variables.id) });
    },
  });
}

export function useDeleteInterventionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteIntervention,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interventionKeys.lists() });
    },
  });
}

// =============================================================================
// Food Correlation Types
// =============================================================================

export interface FoodCorrelationResult {
  food_name: string;
  times_eaten: number;
  avg_bristol_after: number | null;
  correlation: number;
  p_value: number;
  is_significant: boolean;
  is_trigger: boolean;
  avg_bristol_when_eaten: number | null;
  avg_bristol_when_not_eaten: number | null;
}

export interface FoodAnalysisResponse {
  total_foods_analyzed: number;
  total_food_logs: number;
  total_bristol_events: number;
  analysis_start_date: string;
  analysis_end_date: string;
  results: FoodCorrelationResult[];
  trigger_foods: FoodCorrelationResult[];
}

export interface FoodAnalysisParams {
  startDate: string;
  endDate: string;
  minOccurrences?: number;
  timeLagHours?: number;
}

// =============================================================================
// Food Correlation Query Keys
// =============================================================================

export const foodAnalysisKeys = {
  all: ["foodAnalysis"] as const,
  analysis: (params: FoodAnalysisParams) => [...foodAnalysisKeys.all, params] as const,
};

// =============================================================================
// Food Correlation API Functions
// =============================================================================

async function getFoodAnalysis(params: FoodAnalysisParams): Promise<FoodAnalysisResponse> {
  const searchParams = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
  });
  if (params.minOccurrences) {
    searchParams.append("min_occurrences", params.minOccurrences.toString());
  }
  if (params.timeLagHours) {
    searchParams.append("time_lag_hours", params.timeLagHours.toString());
  }
  const response = await apiClient.get(`/cronometer/insights/foods?${searchParams.toString()}`);
  return response.data;
}

// =============================================================================
// Food Correlation Hooks
// =============================================================================

export function useFoodAnalysisQuery(params: FoodAnalysisParams, enabled: boolean = true) {
  return useQuery({
    queryKey: foodAnalysisKeys.analysis(params),
    queryFn: () => getFoodAnalysis(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}

// =============================================================================
// Timeline Types
// =============================================================================

export interface BristolEvent {
  timestamp: string;
  bristol_score: number;
  quantity_score: number | null;
}

export interface DailyTimelineData {
  day: string;
  nutrients: Record<string, number>;
  bristol_events: BristolEvent[];
}

export interface TimelineResponse {
  start_date: string;
  end_date: string;
  nutrient_keys: string[];
  daily_data: DailyTimelineData[];
}

export interface TimelineParams {
  startDate: string;
  endDate: string;
  nutrients: string[];
}

// =============================================================================
// Timeline Query Keys
// =============================================================================

export const timelineKeys = {
  all: ["timeline"] as const,
  byParams: (params: TimelineParams) => [...timelineKeys.all, params] as const,
};

// =============================================================================
// Timeline API Functions
// =============================================================================

async function getTimeline(params: TimelineParams): Promise<TimelineResponse> {
  const searchParams = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
  });
  // Add each nutrient as a separate query param
  for (const nutrient of params.nutrients) {
    searchParams.append("nutrients", nutrient);
  }
  const response = await apiClient.get<TimelineResponse>(
    `/cronometer/insights/timeline?${searchParams.toString()}`
  );
  return response.data;
}

// =============================================================================
// Timeline Hooks
// =============================================================================

export function useTimelineQuery(params: TimelineParams, enabled: boolean = true) {
  return useQuery({
    queryKey: timelineKeys.byParams(params),
    queryFn: () => getTimeline(params),
    enabled: enabled && !!params.startDate && !!params.endDate && params.nutrients.length > 0,
  });
}
