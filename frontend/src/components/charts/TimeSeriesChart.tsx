"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  Cell,
  TooltipProps,
} from "recharts";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { format, parseISO } from "date-fns";

// =============================================================================
// Types
// =============================================================================

/**
 * Bristol event data from the backend API
 */
export interface BristolEvent {
  timestamp: string; // ISO datetime
  bristol_score: number; // 1-7
  quantity_score: number | null;
}

/**
 * Daily timeline data point containing nutrients and Bristol events
 */
export interface DailyTimelineData {
  day: string; // ISO date
  nutrients: Record<string, number>; // nutrient_key -> total value
  bristol_events: BristolEvent[];
}

/**
 * Timeline response from the backend API
 */
export interface TimelineResponse {
  start_date: string;
  end_date: string;
  nutrient_keys: string[];
  daily_data: DailyTimelineData[];
}

/**
 * Props for the TimeSeriesChart component
 */
export interface TimeSeriesChartProps {
  /** Timeline data from the API */
  timelineData: TimelineResponse;
  /** Array of nutrient keys to display as lines */
  selectedNutrients: string[];
  /** Whether to show Bristol events as scatter points */
  showBristolEvents: boolean;
  /** Optional callback when a nutrient is toggled in the legend */
  onNutrientToggle?: (nutrientKey: string) => void;
  /** Optional chart height in pixels (default: 400) */
  height?: number;
  /** Optional: show brush for range selection */
  showBrush?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Color palette for nutrient lines
 * Distinct colors that work well together on charts
 */
const NUTRIENT_COLORS = [
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#84cc16", // Lime
  "#06b6d4", // Cyan
  "#f43f5e", // Rose
  "#a855f7", // Violet
  "#22c55e", // Green
  "#eab308", // Yellow
  "#6366f1", // Indigo
] as const;

/**
 * Bristol score colors based on health classification
 */
const BRISTOL_COLORS = {
  healthy: "#10b981", // Green for scores 3-5
  borderline: "#eab308", // Yellow for scores 2 or 6
  concerning: "#ef4444", // Red for scores 1 or 7
} as const;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Gets the color for a Bristol score based on health classification
 */
function getBristolScoreColor(score: number): string {
  if (score >= 3 && score <= 5) {
    return BRISTOL_COLORS.healthy;
  }
  if (score === 2 || score === 6) {
    return BRISTOL_COLORS.borderline;
  }
  return BRISTOL_COLORS.concerning;
}

/**
 * Formats a date for display on the X-axis
 */
function formatDateShort(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, "MMM d");
  } catch {
    return dateStr;
  }
}

/**
 * Formats a timestamp for tooltip display
 */
function formatTimestamp(timestamp: string): string {
  try {
    const date = parseISO(timestamp);
    return format(date, "MMM d, h:mm a");
  } catch {
    return timestamp;
  }
}

/**
 * Gets a color for a nutrient based on its index
 */
function getNutrientColor(index: number): string {
  return NUTRIENT_COLORS[index % NUTRIENT_COLORS.length];
}

/**
 * Formats a nutrient key for display (e.g., "vitamin_c" -> "Vitamin C")
 */
function formatNutrientName(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// =============================================================================
// Chart Data Processing
// =============================================================================

interface ProcessedChartData {
  day: string;
  displayDate: string;
  [key: string]: string | number | BristolEvent[] | undefined;
  bristolEvents?: BristolEvent[];
}

interface ProcessedBristolPoint {
  day: string;
  displayDate: string;
  bristolScore: number;
  timestamp: string;
  quantityScore: number | null;
}

/**
 * Processes timeline data into a format suitable for Recharts
 */
function processChartData(
  timelineData: TimelineResponse,
  selectedNutrients: string[]
): {
  chartData: ProcessedChartData[];
  bristolPoints: ProcessedBristolPoint[];
} {
  const chartData: ProcessedChartData[] = [];
  const bristolPoints: ProcessedBristolPoint[] = [];

  for (const dayData of timelineData.daily_data) {
    const dataPoint: ProcessedChartData = {
      day: dayData.day,
      displayDate: formatDateShort(dayData.day),
    };

    // Add selected nutrient values
    for (const nutrientKey of selectedNutrients) {
      const value = dayData.nutrients[nutrientKey];
      dataPoint[nutrientKey] = value !== undefined ? value : undefined;
    }

    // Store bristol events for reference
    dataPoint.bristolEvents = dayData.bristol_events;

    chartData.push(dataPoint);

    // Process Bristol events for scatter plot
    for (const event of dayData.bristol_events) {
      bristolPoints.push({
        day: dayData.day,
        displayDate: formatDateShort(dayData.day),
        bristolScore: event.bristol_score,
        timestamp: event.timestamp,
        quantityScore: event.quantity_score,
      });
    }
  }

  return { chartData, bristolPoints };
}

// =============================================================================
// Custom Tooltip Component
// =============================================================================

interface CustomTooltipPayload {
  day: string;
  displayDate: string;
  bristolEvents?: BristolEvent[];
  [key: string]: string | number | BristolEvent[] | undefined;
}

interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
  selectedNutrients: string[];
  nutrientColorMap: Map<string, string>;
  showBristolEvents: boolean;
}

function CustomTooltip({
  active,
  payload,
  selectedNutrients,
  nutrientColorMap,
  showBristolEvents,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0]?.payload as CustomTooltipPayload;
  if (!data) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-xs">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
        {data.displayDate}
      </p>

      {/* Nutrient values */}
      {selectedNutrients.length > 0 && (
        <div className="space-y-1 mb-2">
          {selectedNutrients.map((nutrientKey) => {
            const value = data[nutrientKey];
            if (value === undefined || typeof value !== "number") return null;

            return (
              <div key={nutrientKey} className="flex items-center gap-2 text-sm">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: nutrientColorMap.get(nutrientKey) }}
                />
                <span className="text-gray-600 dark:text-gray-400">
                  {formatNutrientName(nutrientKey)}:
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {value.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Bristol events */}
      {showBristolEvents &&
        data.bristolEvents &&
        data.bristolEvents.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bristol Events:
            </p>
            {data.bristolEvents.map((event, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getBristolScoreColor(event.bristol_score) }}
                />
                <span className="text-gray-600 dark:text-gray-400">
                  Score {event.bristol_score}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  ({formatTimestamp(event.timestamp)})
                </span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * TimeSeriesChart component for visualizing nutrient intake and Bristol events
 * over time.
 *
 * Displays a composed chart with:
 * - Line charts for selected nutrients (left Y-axis)
 * - Scatter plot for Bristol events (right Y-axis, 1-7)
 * - Interactive tooltips with detailed information
 * - Optional brush for range selection
 * - Responsive sizing
 *
 * @example
 * ```tsx
 * <TimeSeriesChart
 *   timelineData={apiResponse}
 *   selectedNutrients={["fiber", "protein"]}
 *   showBristolEvents={true}
 *   onNutrientToggle={(key) => toggleNutrient(key)}
 * />
 * ```
 */
export function TimeSeriesChart({
  timelineData,
  selectedNutrients,
  showBristolEvents,
  onNutrientToggle,
  height = 400,
  showBrush = false,
}: TimeSeriesChartProps) {
  // Process data for the chart
  const { chartData, bristolPoints, nutrientColorMap } = useMemo(() => {
    const { chartData, bristolPoints } = processChartData(
      timelineData,
      selectedNutrients
    );

    // Create color map for nutrients
    const colorMap = new Map<string, string>();
    selectedNutrients.forEach((nutrientKey, index) => {
      colorMap.set(nutrientKey, getNutrientColor(index));
    });

    return { chartData, bristolPoints, nutrientColorMap: colorMap };
  }, [timelineData, selectedNutrients]);

  // Handle legend click for toggling nutrients
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLegendClick = (data: any) => {
    if (onNutrientToggle && data.dataKey && typeof data.dataKey === "string") {
      onNutrientToggle(data.dataKey);
    }
  };

  // Empty state
  if (!timelineData.daily_data || timelineData.daily_data.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center text-gray-500 dark:text-gray-400"
        style={{ height }}
      >
        <div className="text-center">
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm mt-1">
            Timeline data will appear here once available.
          </p>
        </div>
      </div>
    );
  }

  // Check if there are no selected nutrients and no Bristol events to show
  if (selectedNutrients.length === 0 && !showBristolEvents) {
    return (
      <div
        className="w-full flex items-center justify-center text-gray-500 dark:text-gray-400"
        style={{ height }}
      >
        <div className="text-center">
          <p className="text-lg font-medium">No data selected</p>
          <p className="text-sm mt-1">
            Select nutrients or enable Bristol events to view the chart.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: showBristolEvents ? 60 : 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          {/* X-Axis: Dates */}
          <XAxis
            dataKey="displayDate"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickLine={{ stroke: "#d1d5db" }}
            axisLine={{ stroke: "#d1d5db" }}
            interval="preserveStartEnd"
            minTickGap={30}
          />

          {/* Left Y-Axis: Nutrient values */}
          {selectedNutrients.length > 0 && (
            <YAxis
              yAxisId="nutrients"
              orientation="left"
              tick={{ fill: "#6b7280", fontSize: 11 }}
              tickLine={{ stroke: "#d1d5db" }}
              axisLine={{ stroke: "#d1d5db" }}
              label={{
                value: "Nutrient Value",
                angle: -90,
                position: "insideLeft",
                offset: 0,
                style: { fill: "#6b7280", fontSize: 12 },
              }}
            />
          )}

          {/* Right Y-Axis: Bristol scale (only if showing Bristol events) */}
          {showBristolEvents && (
            <YAxis
              yAxisId="bristol"
              orientation="right"
              domain={[1, 7]}
              ticks={[1, 2, 3, 4, 5, 6, 7]}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              tickLine={{ stroke: "#d1d5db" }}
              axisLine={{ stroke: "#d1d5db" }}
              label={{
                value: "Bristol Score",
                angle: 90,
                position: "insideRight",
                offset: 0,
                style: { fill: "#6b7280", fontSize: 12 },
              }}
            />
          )}

          {/* Tooltip */}
          <Tooltip
            content={
              <CustomTooltip
                selectedNutrients={selectedNutrients}
                nutrientColorMap={nutrientColorMap}
                showBristolEvents={showBristolEvents}
              />
            }
          />

          {/* Legend */}
          <Legend
            onClick={onNutrientToggle ? handleLegendClick : undefined}
            wrapperStyle={{
              cursor: onNutrientToggle ? "pointer" : "default",
              paddingTop: "10px",
            }}
            formatter={(value: string) => (
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {typeof value === "string" ? formatNutrientName(value) : value}
              </span>
            )}
          />

          {/* Nutrient lines */}
          {selectedNutrients.map((nutrientKey, index) => (
            <Line
              key={nutrientKey}
              yAxisId="nutrients"
              type="monotone"
              dataKey={nutrientKey}
              name={nutrientKey}
              stroke={getNutrientColor(index)}
              strokeWidth={2}
              dot={{ r: 3, fill: getNutrientColor(index) }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
              connectNulls
            />
          ))}

          {/* Bristol events as scatter points */}
          {showBristolEvents && bristolPoints.length > 0 && (
            <Scatter
              yAxisId="bristol"
              data={bristolPoints}
              dataKey="bristolScore"
              name="Bristol Score"
              fill="#6b7280"
            >
              {bristolPoints.map((entry, index) => (
                <Cell
                  key={`bristol-${index}`}
                  fill={getBristolScoreColor(entry.bristolScore)}
                  stroke="#fff"
                  strokeWidth={1}
                />
              ))}
            </Scatter>
          )}

          {/* Optional brush for range selection */}
          {showBrush && chartData.length > 7 && (
            <Brush
              dataKey="displayDate"
              height={30}
              stroke="#8884d8"
              startIndex={Math.max(0, chartData.length - 14)}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Bristol score legend */}
      {showBristolEvents && (
        <div className="flex justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: BRISTOL_COLORS.healthy }}
            />
            <span className="text-gray-600 dark:text-gray-400">
              Healthy (3-5)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: BRISTOL_COLORS.borderline }}
            />
            <span className="text-gray-600 dark:text-gray-400">
              Borderline (2, 6)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: BRISTOL_COLORS.concerning }}
            />
            <span className="text-gray-600 dark:text-gray-400">
              Concerning (1, 7)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
