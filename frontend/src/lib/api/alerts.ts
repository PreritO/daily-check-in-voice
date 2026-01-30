import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

// =============================================================================
// Types
// =============================================================================

export type AlertType = "mood_concern" | "missed_calls";

export interface Alert {
  id: string;
  user_id: string;
  call_id: string | null;
  alert_type: AlertType;
  title: string;
  message: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

// =============================================================================
// API Functions
// =============================================================================

export async function getAlerts(acknowledged?: boolean): Promise<Alert[]> {
  const params = new URLSearchParams();
  if (acknowledged !== undefined) {
    params.set("acknowledged", String(acknowledged));
  }
  const url = params.toString() ? `/alerts/?${params.toString()}` : "/alerts/";
  const response = await apiClient.get<Alert[]>(url);
  return response.data;
}

export async function acknowledgeAlert(alertId: string): Promise<Alert> {
  const response = await apiClient.post<Alert>(`/alerts/${alertId}/acknowledge`);
  return response.data;
}

// =============================================================================
// React Query Hooks
// =============================================================================

export const alertsKeys = {
  all: ["alerts"] as const,
  list: (acknowledged?: boolean) => [...alertsKeys.all, "list", acknowledged] as const,
  unacknowledged: () => [...alertsKeys.all, "unacknowledged"] as const,
};

export function useAlertsQuery(acknowledged?: boolean) {
  return useQuery({
    queryKey: alertsKeys.list(acknowledged),
    queryFn: () => getAlerts(acknowledged),
  });
}

export function useUnacknowledgedAlertsQuery() {
  return useQuery({
    queryKey: alertsKeys.unacknowledged(),
    queryFn: () => getAlerts(false),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useAcknowledgeAlertMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      // Invalidate all alert queries to refetch
      queryClient.invalidateQueries({ queryKey: alertsKeys.all });
    },
  });
}
