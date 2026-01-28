import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

// =============================================================================
// Types
// =============================================================================

export interface Schedule {
  id: string;
  user_id: string;
  enabled: boolean;
  cron_expression: string;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// API Functions
// =============================================================================

interface GetSchedulesParams {
  userId?: string;
  skip?: number;
  limit?: number;
}

async function getSchedules(params: GetSchedulesParams = {}): Promise<Schedule[]> {
  const { userId, skip = 0, limit = 100 } = params;
  const queryParams = new URLSearchParams();
  if (userId) queryParams.set("user_id", userId);
  queryParams.set("skip", String(skip));
  queryParams.set("limit", String(limit));

  const response = await apiClient.get<Schedule[]>(`/schedules/?${queryParams}`);
  return response.data;
}

async function getSchedule(id: string): Promise<Schedule> {
  const response = await apiClient.get<Schedule>(`/schedules/${id}`);
  return response.data;
}

interface CreateScheduleParams {
  user_id: string;
  cron_expression: string;
  enabled?: boolean;
}

async function createSchedule(params: CreateScheduleParams): Promise<Schedule> {
  const response = await apiClient.post<Schedule>("/schedules/", params);
  return response.data;
}

interface UpdateScheduleParams {
  id: string;
  enabled?: boolean;
  cron_expression?: string;
}

async function updateSchedule({ id, ...data }: UpdateScheduleParams): Promise<Schedule> {
  const response = await apiClient.patch<Schedule>(`/schedules/${id}`, data);
  return response.data;
}

async function deleteSchedule(id: string): Promise<void> {
  await apiClient.delete(`/schedules/${id}`);
}

// =============================================================================
// React Query Hooks
// =============================================================================

export const schedulesKeys = {
  all: ["schedules"] as const,
  lists: () => [...schedulesKeys.all, "list"] as const,
  list: (params: GetSchedulesParams) => [...schedulesKeys.lists(), params] as const,
  details: () => [...schedulesKeys.all, "detail"] as const,
  detail: (id: string) => [...schedulesKeys.details(), id] as const,
};

export function useSchedulesQuery(params: GetSchedulesParams = {}) {
  return useQuery({
    queryKey: schedulesKeys.list(params),
    queryFn: () => getSchedules(params),
  });
}

export function useScheduleQuery(id: string) {
  return useQuery({
    queryKey: schedulesKeys.detail(id),
    queryFn: () => getSchedule(id),
    enabled: !!id,
  });
}

export function useCreateScheduleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulesKeys.lists() });
    },
  });
}

export function useUpdateScheduleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSchedule,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: schedulesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: schedulesKeys.detail(data.id) });
    },
  });
}

export function useDeleteScheduleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulesKeys.lists() });
    },
  });
}

// =============================================================================
// Cron Expression Helpers
// =============================================================================

export const WEEKDAYS = [
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "0", label: "Sun" },
] as const;

export interface ParsedCron {
  minute: number;
  hour: number;
  daysOfWeek: string[];
}

/**
 * Parse a cron expression into a human-readable format.
 * Expected format: "minute hour * * days"
 */
export function parseCronExpression(cron: string): ParsedCron | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minute, hour, , , daysOfWeek] = parts;
  const minuteNum = parseInt(minute, 10);
  const hourNum = parseInt(hour, 10);

  if (isNaN(minuteNum) || isNaN(hourNum)) return null;

  // Parse days of week (could be "*", "1-5", "1,2,3,4,5", etc.)
  let days: string[] = [];
  if (daysOfWeek === "*") {
    days = ["0", "1", "2", "3", "4", "5", "6"];
  } else if (daysOfWeek.includes("-")) {
    const [start, end] = daysOfWeek.split("-").map(Number);
    for (let i = start; i <= end; i++) {
      days.push(String(i));
    }
  } else if (daysOfWeek.includes(",")) {
    days = daysOfWeek.split(",");
  } else {
    days = [daysOfWeek];
  }

  return {
    minute: minuteNum,
    hour: hourNum,
    daysOfWeek: days,
  };
}

/**
 * Build a cron expression from components.
 */
export function buildCronExpression(hour: number, minute: number, daysOfWeek: string[]): string {
  const days = daysOfWeek.length === 7 ? "*" : daysOfWeek.join(",");
  return `${minute} ${hour} * * ${days}`;
}

/**
 * Format a time (hour, minute) to a display string.
 */
export function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  const displayMinute = minute.toString().padStart(2, "0");
  return `${displayHour}:${displayMinute} ${period}`;
}
