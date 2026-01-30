"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useUnacknowledgedAlertsQuery, useAcknowledgeAlertMutation, type Alert, type AlertType } from "@/lib/api/alerts";

function getAlertTypeIcon(alertType: AlertType): React.ReactNode {
  switch (alertType) {
    case "mood_concern":
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case "missed_calls":
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      );
  }
}

function getAlertTypeClasses(alertType: AlertType): string {
  switch (alertType) {
    case "mood_concern":
      return "border-[#F5D89A] bg-[#FFF9E6] dark:border-[#F5D89A]/50 dark:bg-[#F5D89A]/10";
    case "missed_calls":
      return "border-[#F9E4EC] bg-[#F9E4EC]/50 dark:border-[#E8A0BF]/50 dark:bg-[#E8A0BF]/10";
  }
}

function getAlertIconClasses(alertType: AlertType): string {
  switch (alertType) {
    case "mood_concern":
      return "text-[#B8A060] dark:text-[#F5D89A]";
    case "missed_calls":
      return "text-[#C07A9D] dark:text-[#E8A0BF]";
  }
}

function AlertItem({
  alert,
  onAcknowledge,
  isAcknowledging,
}: {
  alert: Alert;
  onAcknowledge: () => void;
  isAcknowledging: boolean;
}) {
  const timeAgo = formatDistanceToNow(new Date(alert.created_at), { addSuffix: true });

  return (
    <div
      className={`rounded-xl border p-4 ${getAlertTypeClasses(alert.alert_type)}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex-shrink-0 ${getAlertIconClasses(alert.alert_type)}`}>
          {getAlertTypeIcon(alert.alert_type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]">
              {alert.title}
            </h3>
            <span className="text-xs text-[#A89B86] dark:text-[#B8A99A] whitespace-nowrap">
              {timeAgo}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#A89B86] dark:text-[#B8A99A]">
            {alert.message}
          </p>
          <div className="mt-3 flex items-center gap-3">
            {alert.call_id && (
              <Link
                href={`/calls/${alert.call_id}`}
                className="text-sm font-medium text-[#E8A0BF] hover:text-[#D88FAE]"
              >
                View call
              </Link>
            )}
            <button
              onClick={onAcknowledge}
              disabled={isAcknowledging}
              className="text-sm font-medium text-[#A89B86] hover:text-[#4A4543] dark:text-[#B8A99A] dark:hover:text-[#F5F3F0] disabled:opacity-50"
            >
              {isAcknowledging ? "Dismissing..." : "Dismiss"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlertBanner() {
  const { data: alerts, isLoading } = useUnacknowledgedAlertsQuery();
  const acknowledgeMutation = useAcknowledgeAlertMutation();

  // Don't render anything while loading or if no alerts
  if (isLoading || !alerts || alerts.length === 0) {
    return null;
  }

  const handleAcknowledge = (alertId: string) => {
    acknowledgeMutation.mutate(alertId);
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <AlertItem
          key={alert.id}
          alert={alert}
          onAcknowledge={() => handleAcknowledge(alert.id)}
          isAcknowledging={acknowledgeMutation.isPending}
        />
      ))}
    </div>
  );
}
