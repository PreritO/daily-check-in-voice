"use client";

import { useMemo } from "react";
import { format, parseISO, subDays } from "date-fns";
import { FoodLog, HealthNote, useFoodLogsQuery } from "@/lib/api/cronometer";

// =============================================================================
// Types
// =============================================================================

export interface FoodLogModalProps {
  /** The selected date to show food logs for */
  selectedDate: Date;
  /** Bristol events for the selected date */
  bristolEvents: {
    bristol_scale: number | null;
    quantity_score: number | null;
    logged_at: string;
  }[];
  /** Callback to close the modal */
  onClose: () => void;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Gets the color for a Bristol score based on health classification
 */
function getBristolColor(score: number | null): string {
  if (score === null) return "#6b7280";
  if (score >= 3 && score <= 5) return "#10b981"; // Green - healthy
  if (score === 2 || score === 6) return "#eab308"; // Yellow - borderline
  return "#ef4444"; // Red - concerning
}

/**
 * Format nutrient value with fallback
 */
function formatNutrient(value: number | null, unit: string): string {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(0)}${unit}`;
}

// =============================================================================
// Component
// =============================================================================

/**
 * FoodLogModal displays food logs for a selected day and the preceding day
 * from the CalendarHeatmap. This helps users understand what they ate that
 * may have affected their Bristol score.
 */
export function FoodLogModal({
  selectedDate,
  bristolEvents,
  onClose,
}: FoodLogModalProps) {
  // Calculate date range: day before and selected day
  const dayBefore = useMemo(() => subDays(selectedDate, 1), [selectedDate]);

  // Format dates for display and API query
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const dayBeforeStr = format(dayBefore, "yyyy-MM-dd");

  // Fetch food logs for both days
  const { data: foodLogs, isLoading, error } = useFoodLogsQuery(
    dayBeforeStr,
    selectedDateStr
  );

  // Separate food logs by day
  const { dayBeforeLogs, selectedDayLogs } = useMemo(() => {
    if (!foodLogs) {
      return { dayBeforeLogs: [], selectedDayLogs: [] };
    }

    const before: FoodLog[] = [];
    const selected: FoodLog[] = [];

    for (const log of foodLogs) {
      const logDate = format(parseISO(log.logged_at), "yyyy-MM-dd");
      if (logDate === dayBeforeStr) {
        before.push(log);
      } else if (logDate === selectedDateStr) {
        selected.push(log);
      }
    }

    // Sort by time logged
    before.sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
    selected.sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());

    return { dayBeforeLogs: before, selectedDayLogs: selected };
  }, [foodLogs, dayBeforeStr, selectedDateStr]);

  // Render a food log item
  const renderFoodItem = (log: FoodLog) => (
    <div
      key={log.id}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
          {log.food_name}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{log.serving_size}</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span>{format(parseISO(log.logged_at), "h:mm a")}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
          {formatNutrient(log.calories, " cal")}
        </span>
        <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
          {formatNutrient(log.fiber_g, "g fiber")}
        </span>
        <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
          {formatNutrient(log.protein_g, "g protein")}
        </span>
      </div>
    </div>
  );

  // Render a day section
  const renderDaySection = (title: string, dateStr: string, logs: FoodLog[]) => (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <span>{title}</span>
        <span className="font-normal text-gray-500 dark:text-gray-400">
          ({format(parseISO(dateStr), "EEE, MMM d")})
        </span>
        <span className="ml-auto text-xs font-normal text-gray-400 dark:text-gray-500">
          {logs.length} item{logs.length !== 1 ? "s" : ""}
        </span>
      </h4>

      {logs.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic py-2">
          No food logs recorded
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {logs.map(renderFoodItem)}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="food-log-modal-title"
        className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-[#DEDDDB] bg-white shadow-xl dark:border-[#3D3935] dark:bg-[#363230]"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3
              id="food-log-modal-title"
              className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]"
            >
              Food Log - {format(selectedDate, "MMMM d, yyyy")}
            </h3>

            {/* Bristol scores for the day */}
            {bristolEvents.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Bristol scores:
                </span>
                {bristolEvents.map((event, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: getBristolColor(event.bristol_scale) }}
                  >
                    {event.bristol_scale || "?"}
                    <span className="text-white/70">
                      @ {format(parseISO(event.logged_at), "h:mm a")}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg
                className="h-8 w-8 animate-spin text-[#E8A0BF]"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 dark:text-red-400">
                Failed to load food logs. Please try again.
              </p>
            </div>
          ) : (
            <>
              {/* Day Before Section */}
              {renderDaySection("Day Before", dayBeforeStr, dayBeforeLogs)}

              {/* Divider */}
              <hr className="border-gray-200 dark:border-gray-700" />

              {/* Selected Day Section */}
              {renderDaySection("Selected Day", selectedDateStr, selectedDayLogs)}
            </>
          )}
        </div>

        {/* Footer with explanation */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Food takes 12-72 hours to affect digestion. Review both days to identify potential causes.
          </p>
        </div>
      </div>
    </div>
  );
}
