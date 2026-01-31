"use client";

import { useMemo, useState } from "react";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  isValid,
} from "date-fns";

// =============================================================================
// Types
// =============================================================================

/**
 * Health note data point representing a single bowel movement entry
 */
export interface HealthNoteData {
  /** ISO datetime string of when the entry was logged */
  logged_at: string;
  /** Bristol scale score (1-7) or null if not recorded */
  bristol_scale: number | null;
  /** Quantity score or null if not recorded */
  quantity_score: number | null;
}

/**
 * Props for the CalendarHeatmap component
 */
export interface CalendarHeatmapProps {
  /** Array of health note data points to display */
  healthNotes: HealthNoteData[];
  /** Start date of the date range to display */
  startDate: Date | string;
  /** End date of the date range to display */
  endDate: Date | string;
  /** Optional callback when a day cell is clicked */
  onDayClick?: (date: Date, events: HealthNoteData[]) => void;
}

interface DayData {
  date: Date;
  events: HealthNoteData[];
  averageBristol: number | null;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: DayData | null;
}

// =============================================================================
// Constants
// =============================================================================

const COLORS = {
  healthy: "#10b981", // Green for scores 3-5
  borderline: "#eab308", // Yellow for scores 2 or 6
  concerning: "#ef4444", // Red for scores 1 or 7
  noData: "#e5e7eb", // Gray for no BM logged
} as const;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const SHORT_DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const CELL_SIZE = 12;
const CELL_GAP = 2;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parses a date input (Date object or ISO string) into a valid Date
 */
function parseDate(date: Date | string): Date | null {
  if (date instanceof Date) {
    return isValid(date) ? date : null;
  }
  if (typeof date === "string") {
    const parsed = parseISO(date);
    return isValid(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Gets the color for a Bristol score based on health classification
 */
function getBristolColor(score: number | null): string {
  if (score === null) {
    return COLORS.noData;
  }

  const roundedScore = Math.round(score);

  if (roundedScore >= 3 && roundedScore <= 5) {
    return COLORS.healthy;
  }
  if (roundedScore === 2 || roundedScore === 6) {
    return COLORS.borderline;
  }
  if (roundedScore === 1 || roundedScore === 7) {
    return COLORS.concerning;
  }

  return COLORS.noData;
}

/**
 * Calculates the average Bristol score from an array of health notes
 */
function calculateAverageBristol(events: HealthNoteData[]): number | null {
  const bristolScores = events
    .map((e) => e.bristol_scale)
    .filter((score): score is number => score !== null);

  if (bristolScores.length === 0) {
    return null;
  }

  const sum = bristolScores.reduce((acc, score) => acc + score, 0);
  return sum / bristolScores.length;
}

/**
 * Formats a date for display in the tooltip
 */
function formatDateForDisplay(date: Date): string {
  return format(date, "EEEE, MMMM d, yyyy");
}

/**
 * Formats a Bristol score for display
 */
function formatBristolScore(score: number): string {
  return score.toFixed(1);
}

// =============================================================================
// Component
// =============================================================================

/**
 * CalendarHeatmap component for visualizing daily Bristol scores in a
 * GitHub-style contribution graph.
 *
 * Features:
 * - Weeks as columns (left to right = older to newer)
 * - Days as rows (top = Sunday, bottom = Saturday)
 * - Color coding by Bristol score health classification
 * - Tooltips showing date and score details
 * - Click handler for day selection
 *
 * Color coding:
 * - Green: Bristol 3-5 (healthy)
 * - Yellow: Bristol 2 or 6 (borderline)
 * - Red: Bristol 1 or 7 (concerning)
 * - Gray: No bowel movement logged
 *
 * @example
 * ```tsx
 * <CalendarHeatmap
 *   healthNotes={healthNotes}
 *   startDate="2025-01-01"
 *   endDate="2025-12-31"
 *   onDayClick={(date, events) => {
 *     console.log(`Clicked ${date.toISOString()} with ${events.length} events`);
 *   }}
 * />
 * ```
 */
export function CalendarHeatmap({
  healthNotes,
  startDate,
  endDate,
  onDayClick,
}: CalendarHeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });

  // Parse and validate dates
  const parsedStartDate = useMemo(() => parseDate(startDate), [startDate]);
  const parsedEndDate = useMemo(() => parseDate(endDate), [endDate]);

  // Process data into a map of date -> events
  const { dayDataMap, weeks, monthLabels } = useMemo(() => {
    if (!parsedStartDate || !parsedEndDate) {
      return { dayDataMap: new Map<string, DayData>(), weeks: [], monthLabels: [] };
    }

    // Extend range to full weeks
    const rangeStart = startOfWeek(parsedStartDate, { weekStartsOn: 0 });
    const rangeEnd = endOfWeek(parsedEndDate, { weekStartsOn: 0 });

    // Create a map of date string -> events
    const eventsMap = new Map<string, HealthNoteData[]>();

    for (const note of healthNotes) {
      const noteDate = parseISO(note.logged_at);
      if (!isValid(noteDate)) continue;

      const dateKey = format(noteDate, "yyyy-MM-dd");

      if (!eventsMap.has(dateKey)) {
        eventsMap.set(dateKey, []);
      }
      eventsMap.get(dateKey)!.push(note);
    }

    // Build day data map
    const dataMap = new Map<string, DayData>();
    const allDays = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    for (const day of allDays) {
      const dateKey = format(day, "yyyy-MM-dd");
      const events = eventsMap.get(dateKey) || [];
      const averageBristol = calculateAverageBristol(events);

      dataMap.set(dateKey, {
        date: day,
        events,
        averageBristol,
      });
    }

    // Get weeks for column layout
    const weekStarts = eachWeekOfInterval(
      { start: rangeStart, end: rangeEnd },
      { weekStartsOn: 0 }
    );

    // Calculate month labels with positions
    const labels: { month: string; weekIndex: number }[] = [];
    let lastMonth = -1;

    for (let weekIndex = 0; weekIndex < weekStarts.length; weekIndex++) {
      const weekStart = weekStarts[weekIndex];
      const month = weekStart.getMonth();

      if (month !== lastMonth) {
        labels.push({
          month: MONTH_LABELS[month],
          weekIndex,
        });
        lastMonth = month;
      }
    }

    return {
      dayDataMap: dataMap,
      weeks: weekStarts,
      monthLabels: labels,
    };
  }, [healthNotes, parsedStartDate, parsedEndDate]);

  // Handle mouse events for tooltip
  const handleCellMouseEnter = (event: React.MouseEvent, dayData: DayData) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      data: dayData,
    });
  };

  const handleCellMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, data: null });
  };

  // Handle cell click
  const handleCellClick = (dayData: DayData) => {
    if (onDayClick) {
      onDayClick(dayData.date, dayData.events);
    }
  };

  // Empty state
  if (!parsedStartDate || !parsedEndDate) {
    return (
      <div className="w-full h-32 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>Invalid date range provided</p>
      </div>
    );
  }

  if (healthNotes.length === 0 && weeks.length === 0) {
    return (
      <div className="w-full h-32 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>No health data available for the selected date range</p>
      </div>
    );
  }

  // Calculate dimensions
  const dayLabelWidth = 28;
  const monthLabelHeight = 16;
  const chartWidth = dayLabelWidth + weeks.length * (CELL_SIZE + CELL_GAP);
  const chartHeight = monthLabelHeight + 7 * (CELL_SIZE + CELL_GAP);

  return (
    <div className="w-full relative">
      {/* Chart Container */}
      <div className="overflow-x-auto">
        <div
          className="inline-block"
          style={{ minWidth: chartWidth, paddingBottom: 8 }}
        >
          {/* Month Labels */}
          <div
            className="flex"
            style={{
              marginLeft: dayLabelWidth,
              height: monthLabelHeight,
              marginBottom: 4,
            }}
          >
            {monthLabels.map((label, index) => (
              <div
                key={`${label.month}-${index}`}
                className="text-xs text-gray-500 dark:text-gray-400"
                style={{
                  position: "absolute",
                  left: dayLabelWidth + label.weekIndex * (CELL_SIZE + CELL_GAP),
                }}
              >
                {label.month}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex" style={{ marginTop: monthLabelHeight }}>
            {/* Day of Week Labels */}
            <div
              className="flex flex-col justify-between"
              style={{
                width: dayLabelWidth,
                height: 7 * (CELL_SIZE + CELL_GAP) - CELL_GAP,
              }}
            >
              {DAY_LABELS.map((label, index) => (
                <div
                  key={label}
                  className="text-xs text-gray-500 dark:text-gray-400 leading-none"
                  style={{
                    height: CELL_SIZE,
                    display: "flex",
                    alignItems: "center",
                    visibility: index % 2 === 1 ? "visible" : "hidden",
                  }}
                >
                  {SHORT_DAY_LABELS[index]}
                </div>
              ))}
            </div>

            {/* Weeks Grid */}
            <div className="flex" style={{ gap: CELL_GAP }}>
              {weeks.map((weekStart, weekIndex) => {
                const weekDays = eachDayOfInterval({
                  start: weekStart,
                  end: endOfWeek(weekStart, { weekStartsOn: 0 }),
                });

                return (
                  <div
                    key={format(weekStart, "yyyy-MM-dd")}
                    className="flex flex-col"
                    style={{ gap: CELL_GAP }}
                  >
                    {weekDays.map((day) => {
                      const dateKey = format(day, "yyyy-MM-dd");
                      const dayData = dayDataMap.get(dateKey);

                      if (!dayData) {
                        return (
                          <div
                            key={dateKey}
                            className="rounded-sm"
                            style={{
                              width: CELL_SIZE,
                              height: CELL_SIZE,
                              backgroundColor: COLORS.noData,
                              opacity: 0.3,
                            }}
                          />
                        );
                      }

                      const isInRange =
                        day >= parsedStartDate && day <= parsedEndDate;
                      const color = getBristolColor(dayData.averageBristol);

                      return (
                        <div
                          key={dateKey}
                          className={`rounded-sm transition-transform ${
                            onDayClick ? "cursor-pointer hover:scale-110" : ""
                          }`}
                          style={{
                            width: CELL_SIZE,
                            height: CELL_SIZE,
                            backgroundColor: color,
                            opacity: isInRange ? 1 : 0.3,
                          }}
                          onMouseEnter={(e) =>
                            isInRange && handleCellMouseEnter(e, dayData)
                          }
                          onMouseLeave={handleCellMouseLeave}
                          onClick={() =>
                            isInRange && onDayClick && handleCellClick(dayData)
                          }
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-start items-center gap-4 mt-4 text-xs">
        <span className="text-gray-500 dark:text-gray-400">Less</span>
        <div className="flex items-center gap-1">
          <div
            className="rounded-sm"
            style={{
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: COLORS.noData,
            }}
          />
          <div
            className="rounded-sm"
            style={{
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: COLORS.concerning,
            }}
          />
          <div
            className="rounded-sm"
            style={{
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: COLORS.borderline,
            }}
          />
          <div
            className="rounded-sm"
            style={{
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: COLORS.healthy,
            }}
          />
        </div>
        <span className="text-gray-500 dark:text-gray-400">Healthier</span>

        <div className="flex items-center gap-4 ml-4 border-l border-gray-200 dark:border-gray-700 pl-4">
          <div className="flex items-center gap-1">
            <div
              className="rounded-sm"
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: COLORS.healthy,
              }}
            />
            <span className="text-gray-600 dark:text-gray-400">3-5</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="rounded-sm"
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: COLORS.borderline,
              }}
            />
            <span className="text-gray-600 dark:text-gray-400">2, 6</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="rounded-sm"
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: COLORS.concerning,
              }}
            />
            <span className="text-gray-600 dark:text-gray-400">1, 7</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="rounded-sm"
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: COLORS.noData,
              }}
            />
            <span className="text-gray-600 dark:text-gray-400">No data</span>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip.visible && tooltip.data && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {formatDateForDisplay(tooltip.data.date)}
          </p>
          <div className="mt-1 space-y-1 text-sm text-gray-600 dark:text-gray-400">
            {tooltip.data.events.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-500">
                No bowel movement logged
              </p>
            ) : (
              <>
                {tooltip.data.events.map((event, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-1 last:border-b-0 last:pb-0"
                  >
                    <div>
                      {event.bristol_scale !== null && (
                        <p>
                          Bristol:{" "}
                          <span
                            className="font-medium"
                            style={{
                              color: getBristolColor(event.bristol_scale),
                            }}
                          >
                            {event.bristol_scale}
                          </span>
                        </p>
                      )}
                      {event.quantity_score !== null && (
                        <p>
                          Quantity:{" "}
                          <span className="font-medium">
                            {event.quantity_score}
                          </span>
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        {format(parseISO(event.logged_at), "h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
                {tooltip.data.events.length > 1 &&
                  tooltip.data.averageBristol !== null && (
                    <p className="pt-1 border-t border-gray-200 dark:border-gray-600">
                      Average Bristol:{" "}
                      <span
                        className="font-medium"
                        style={{
                          color: getBristolColor(tooltip.data.averageBristol),
                        }}
                      >
                        {formatBristolScore(tooltip.data.averageBristol)}
                      </span>
                    </p>
                  )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
