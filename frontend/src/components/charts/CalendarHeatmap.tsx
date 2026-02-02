"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  getDay,
  isValid,
  addMonths,
  subMonths,
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
  isInRange: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const COLORS = {
  healthy: "#10b981", // Green for scores 3-5
  borderline: "#eab308", // Yellow for scores 2 or 6
  concerning: "#ef4444", // Red for scores 1 or 7
  noData: "#e5e7eb", // Gray for no BM logged
  noDataDark: "#374151", // Dark mode gray
} as const;

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

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
function getBristolColor(score: number | null, isDark: boolean = false): string {
  if (score === null) {
    return isDark ? COLORS.noDataDark : COLORS.noData;
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

  return isDark ? COLORS.noDataDark : COLORS.noData;
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
 * Gets the Bristol score classification text
 */
function getBristolClassification(score: number): string {
  if (score >= 3 && score <= 5) return "Healthy";
  if (score === 2 || score === 6) return "Borderline";
  return "Concerning";
}

// =============================================================================
// Component
// =============================================================================

/**
 * CalendarHeatmap component for visualizing daily Bristol scores in a
 * monthly calendar format.
 *
 * Features:
 * - Full monthly calendar grid layout
 * - Navigation between months within the date range
 * - Color coding by Bristol score health classification
 * - Hover tooltip showing date and score details
 * - Click handler for day selection
 *
 * Color coding:
 * - Green: Bristol 3-5 (healthy)
 * - Yellow: Bristol 2 or 6 (borderline)
 * - Red: Bristol 1 or 7 (concerning)
 * - Gray: No bowel movement logged
 */
export function CalendarHeatmap({
  healthNotes,
  startDate,
  endDate,
  onDayClick,
}: CalendarHeatmapProps) {
  // Parse and validate dates
  const parsedStartDate = useMemo(() => parseDate(startDate), [startDate]);
  const parsedEndDate = useMemo(() => parseDate(endDate), [endDate]);

  // Current displayed month
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    return parsedEndDate || new Date();
  });

  // Hovered day for tooltip
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Process data into a map of date -> events
  const dayDataMap = useMemo(() => {
    if (!parsedStartDate || !parsedEndDate) {
      return new Map<string, DayData>();
    }

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

    // Build day data map for all days in the full range
    const dataMap = new Map<string, DayData>();
    const allDays = eachDayOfInterval({ start: parsedStartDate, end: parsedEndDate });

    for (const day of allDays) {
      const dateKey = format(day, "yyyy-MM-dd");
      const events = eventsMap.get(dateKey) || [];
      const averageBristol = calculateAverageBristol(events);

      dataMap.set(dateKey, {
        date: day,
        events,
        averageBristol,
        isInRange: true,
      });
    }

    return dataMap;
  }, [healthNotes, parsedStartDate, parsedEndDate]);

  // Get days for the current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDayOfWeek = getDay(monthStart);

    // Get all days in the month
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Add empty slots for days before the first day of the month
    const calendarGrid: (DayData | null)[] = Array(startDayOfWeek).fill(null);

    // Add actual days
    for (const day of daysInMonth) {
      const dateKey = format(day, "yyyy-MM-dd");
      const existingData = dayDataMap.get(dateKey);

      if (existingData) {
        calendarGrid.push(existingData);
      } else {
        // Day is outside the data range
        calendarGrid.push({
          date: day,
          events: [],
          averageBristol: null,
          isInRange: false,
        });
      }
    }

    // Fill remaining slots to complete the grid (up to 42 cells for 6 rows)
    while (calendarGrid.length < 42 && calendarGrid.length % 7 !== 0) {
      calendarGrid.push(null);
    }

    return calendarGrid;
  }, [currentMonth, dayDataMap]);

  // Navigation handlers
  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  }, []);

  // Check if navigation is allowed
  const canGoPrevious = useMemo(() => {
    if (!parsedStartDate) return false;
    const prevMonth = subMonths(currentMonth, 1);
    return endOfMonth(prevMonth) >= parsedStartDate;
  }, [currentMonth, parsedStartDate]);

  const canGoNext = useMemo(() => {
    if (!parsedEndDate) return false;
    const nextMonth = addMonths(currentMonth, 1);
    return startOfMonth(nextMonth) <= parsedEndDate;
  }, [currentMonth, parsedEndDate]);

  // Handle mouse events for tooltip
  const handleCellMouseEnter = useCallback(
    (event: React.MouseEvent, dayData: DayData) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const cellRect = (event.target as HTMLElement).getBoundingClientRect();

      setTooltipPosition({
        x: cellRect.left - containerRect.left + cellRect.width / 2,
        y: cellRect.top - containerRect.top,
      });
      setHoveredDay(dayData);
    },
    []
  );

  const handleCellMouseLeave = useCallback(() => {
    setHoveredDay(null);
  }, []);

  // Handle cell click
  const handleCellClick = useCallback(
    (dayData: DayData) => {
      if (onDayClick && dayData.isInRange) {
        onDayClick(dayData.date, dayData.events);
      }
    },
    [onDayClick]
  );

  // Empty state
  if (!parsedStartDate || !parsedEndDate) {
    return (
      <div className="w-full h-32 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>Invalid date range provided</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full relative">
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          disabled={!canGoPrevious}
          className={`p-2 rounded-lg transition-colors ${
            canGoPrevious
              ? "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
          }`}
          aria-label="Previous month"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {format(currentMonth, "MMMM yyyy")}
        </h3>

        <button
          onClick={goToNextMonth}
          disabled={!canGoNext}
          className={`p-2 rounded-lg transition-colors ${
            canGoNext
              ? "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
          }`}
          aria-label="Next month"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_HEADERS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((dayData, index) => {
          if (!dayData) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const isToday = isSameDay(dayData.date, new Date());
          const isCurrentMonth = isSameMonth(dayData.date, currentMonth);
          const hasEvents = dayData.events.length > 0;

          return (
            <div
              key={format(dayData.date, "yyyy-MM-dd")}
              className={`
                aspect-square rounded-lg flex flex-col items-center justify-center
                relative transition-all duration-150
                ${dayData.isInRange && onDayClick ? "cursor-pointer" : ""}
                ${!isCurrentMonth ? "opacity-30" : ""}
                ${isToday ? "ring-2 ring-blue-500 ring-offset-1" : ""}
                ${dayData.isInRange ? "hover:scale-105 hover:shadow-md" : ""}
              `}
              style={{
                backgroundColor: dayData.isInRange
                  ? getBristolColor(dayData.averageBristol)
                  : "transparent",
              }}
              onMouseEnter={(e) => dayData.isInRange && handleCellMouseEnter(e, dayData)}
              onMouseLeave={handleCellMouseLeave}
              onClick={() => handleCellClick(dayData)}
            >
              <span
                className={`
                  text-xs font-medium
                  ${hasEvents && dayData.averageBristol !== null ? "text-white" : "text-gray-700 dark:text-gray-300"}
                  ${!dayData.isInRange ? "text-gray-400 dark:text-gray-600" : ""}
                `}
              >
                {format(dayData.date, "d")}
              </span>
              {hasEvents && (
                <span
                  className={`
                    text-[10px]
                    ${dayData.averageBristol !== null ? "text-white/80" : "text-gray-500 dark:text-gray-400"}
                  `}
                >
                  {dayData.events.length} BM
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center items-center gap-4 mt-6 text-xs">
        <div className="flex items-center gap-1">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: COLORS.healthy }}
          />
          <span className="text-gray-600 dark:text-gray-400">Healthy (3-5)</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: COLORS.borderline }}
          />
          <span className="text-gray-600 dark:text-gray-400">Borderline (2, 6)</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: COLORS.concerning }}
          />
          <span className="text-gray-600 dark:text-gray-400">Concerning (1, 7)</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600"
            style={{ backgroundColor: COLORS.noData }}
          />
          <span className="text-gray-600 dark:text-gray-400">No data</span>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredDay && (
        <div
          className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y - 8,
            transform: "translate(-50%, -100%)",
            minWidth: "180px",
          }}
        >
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {format(hoveredDay.date, "EEEE, MMM d")}
          </p>

          {hoveredDay.events.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-500">
              No bowel movements logged
            </p>
          ) : (
            <div className="space-y-2">
              {hoveredDay.events.map((event, index) => (
                <div
                  key={index}
                  className="text-sm border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0"
                >
                  {event.bristol_scale !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-gray-400">Bristol:</span>
                      <span
                        className="font-semibold"
                        style={{ color: getBristolColor(event.bristol_scale) }}
                      >
                        {event.bristol_scale}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: getBristolColor(event.bristol_scale),
                          color: "white",
                        }}
                      >
                        {getBristolClassification(event.bristol_scale)}
                      </span>
                    </div>
                  )}
                  {event.quantity_score !== null && (
                    <p className="text-gray-600 dark:text-gray-400">
                      Quantity: <span className="font-medium">{event.quantity_score}/10</span>
                    </p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {format(parseISO(event.logged_at), "h:mm a")}
                  </p>
                </div>
              ))}

              {hoveredDay.events.length > 1 && hoveredDay.averageBristol !== null && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Daily Average:{" "}
                    <span
                      className="font-semibold"
                      style={{ color: getBristolColor(hoveredDay.averageBristol) }}
                    >
                      {hoveredDay.averageBristol.toFixed(1)}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
