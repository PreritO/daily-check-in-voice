"use client";

import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  TooltipProps,
} from "recharts";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

/**
 * Data point for the scatter plot representing nutrient intake vs Bristol score
 */
export interface ScatterDataPoint {
  date: Date;
  nutrientValue: number;
  bristolScore: number;
  unit?: string;
}

/**
 * Props for the ScatterPlot component
 */
export interface ScatterPlotProps {
  /** Array of data points to plot */
  data: ScatterDataPoint[];
  /** Name of the nutrient being displayed (e.g., "Fiber") */
  nutrientName: string;
  /** Time lag in hours between nutrient intake and Bristol score measurement */
  timeLagHours: number;
  /** Optional callback when a data point is clicked */
  onPointClick?: (data: ScatterDataPoint) => void;
}

// Color constants for Bristol score ranges
const COLORS = {
  healthy: "#10b981", // Green for scores 3-5
  borderline: "#eab308", // Yellow for scores 2 or 6
  concerning: "#ef4444", // Red for scores 1 or 7
} as const;

/**
 * Gets the color for a Bristol score based on health classification
 */
function getBristolScoreColor(score: number): string {
  if (score >= 3 && score <= 5) {
    return COLORS.healthy;
  }
  if (score === 2 || score === 6) {
    return COLORS.borderline;
  }
  return COLORS.concerning;
}

/**
 * Formats a date for display in the tooltip
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Calculates linear regression for trend line
 * Returns slope and y-intercept for the line y = mx + b
 */
function calculateLinearRegression(
  data: Array<{ x: number; y: number }>
): { slope: number; intercept: number; minX: number; maxX: number } | null {
  if (data.length < 2) {
    return null;
  }

  const n = data.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let minX = Infinity;
  let maxX = -Infinity;

  for (const point of data) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return null;
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept, minX, maxX };
}

/**
 * Internal data format for the scatter chart
 */
interface ChartDataPoint {
  x: number;
  y: number;
  date: Date;
  unit: string;
  originalData: ScatterDataPoint;
}

/**
 * Custom tooltip component for the scatter plot
 */
function CustomTooltip({
  active,
  payload,
  nutrientName,
}: TooltipProps<ValueType, NameType> & { nutrientName: string }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload as ChartDataPoint;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {formatDate(data.date)}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {nutrientName}: {data.x.toFixed(1)} {data.unit}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Bristol Score:{" "}
        <span
          className="font-medium"
          style={{ color: getBristolScoreColor(data.y) }}
        >
          {data.y}
        </span>
      </p>
    </div>
  );
}

/**
 * ScatterPlot component for visualizing nutrient intake vs Bristol score correlation.
 *
 * Displays a scatter chart with:
 * - X-axis: Nutrient intake amount with unit label
 * - Y-axis: Bristol score (1-7 fixed domain)
 * - Points colored by Bristol score health classification
 * - Trend line showing correlation direction
 * - Interactive tooltip with detailed information
 *
 * @example
 * ```tsx
 * <ScatterPlot
 *   data={[
 *     { date: new Date(), nutrientValue: 25, bristolScore: 4, unit: "g" },
 *     { date: new Date(), nutrientValue: 30, bristolScore: 5, unit: "g" },
 *   ]}
 *   nutrientName="Fiber"
 *   timeLagHours={24}
 *   onPointClick={(point) => console.log(point)}
 * />
 * ```
 */
export function ScatterPlot({
  data,
  nutrientName,
  timeLagHours,
  onPointClick,
}: ScatterPlotProps) {
  // Transform data for the chart and calculate trend line
  const { chartData, trendLine, xAxisLabel, defaultUnit } = useMemo(() => {
    // Determine the most common unit from the data
    const unitCounts = new Map<string, number>();
    for (const point of data) {
      const unit = point.unit || "";
      unitCounts.set(unit, (unitCounts.get(unit) || 0) + 1);
    }
    let mostCommonUnit = "";
    let maxCount = 0;
    for (const [unit, count] of unitCounts) {
      if (count > maxCount) {
        mostCommonUnit = unit;
        maxCount = count;
      }
    }

    // Transform data for Recharts
    const transformed: ChartDataPoint[] = data.map((point) => ({
      x: point.nutrientValue,
      y: point.bristolScore,
      date: point.date,
      unit: point.unit || mostCommonUnit,
      originalData: point,
    }));

    // Calculate trend line
    const regressionData = transformed.map((p) => ({ x: p.x, y: p.y }));
    const regression = calculateLinearRegression(regressionData);

    // Build x-axis label
    const label = mostCommonUnit
      ? `${nutrientName} (${mostCommonUnit})`
      : nutrientName;

    return {
      chartData: transformed,
      trendLine: regression,
      xAxisLabel: label,
      defaultUnit: mostCommonUnit,
    };
  }, [data, nutrientName]);

  // Handle point click
  const handlePointClick = (pointData: ChartDataPoint) => {
    if (onPointClick) {
      onPointClick(pointData.originalData);
    }
  };

  // Calculate trend line segment data for ReferenceLine
  const trendLineSegment = useMemo(() => {
    if (!trendLine) return null;

    const { slope, intercept, minX, maxX } = trendLine;

    // Calculate y values at min and max x, clamped to Bristol scale (1-7)
    const y1 = Math.max(1, Math.min(7, slope * minX + intercept));
    const y2 = Math.max(1, Math.min(7, slope * maxX + intercept));

    return { x1: minX, y1, x2: maxX, y2 };
  }, [trendLine]);

  if (data.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>No data available for this nutrient</p>
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">
        Time lag: {timeLagHours} hours between intake and Bristol score
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            dataKey="x"
            name={nutrientName}
            label={{
              value: xAxisLabel,
              position: "bottom",
              offset: 10,
              style: { fill: "#6b7280", fontSize: 12 },
            }}
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickLine={{ stroke: "#d1d5db" }}
            axisLine={{ stroke: "#d1d5db" }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Bristol Score"
            domain={[1, 7]}
            ticks={[1, 2, 3, 4, 5, 6, 7]}
            label={{
              value: "Bristol Score",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              style: { fill: "#6b7280", fontSize: 12 },
            }}
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickLine={{ stroke: "#d1d5db" }}
            axisLine={{ stroke: "#d1d5db" }}
          />
          <Tooltip
            content={<CustomTooltip nutrientName={nutrientName} />}
            cursor={{ strokeDasharray: "3 3" }}
          />

          {/* Trend line using ReferenceLine with segment */}
          {trendLineSegment && (
            <ReferenceLine
              segment={[
                { x: trendLineSegment.x1, y: trendLineSegment.y1 },
                { x: trendLineSegment.x2, y: trendLineSegment.y2 },
              ]}
              stroke="#6b7280"
              strokeWidth={2}
              strokeDasharray="5 5"
              ifOverflow="extendDomain"
            />
          )}

          {/* Reference lines for healthy Bristol score range */}
          <ReferenceLine
            y={3}
            stroke={COLORS.healthy}
            strokeOpacity={0.3}
            strokeWidth={1}
          />
          <ReferenceLine
            y={5}
            stroke={COLORS.healthy}
            strokeOpacity={0.3}
            strokeWidth={1}
          />

          <Scatter
            data={chartData}
            onClick={(data) => handlePointClick(data as unknown as ChartDataPoint)}
            cursor={onPointClick ? "pointer" : "default"}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getBristolScoreColor(entry.y)}
                stroke={getBristolScoreColor(entry.y)}
                strokeWidth={1}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend for Bristol score colors */}
      <div className="flex justify-center gap-4 mt-2 text-xs">
        <div className="flex items-center gap-1">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: COLORS.healthy }}
          />
          <span className="text-gray-600 dark:text-gray-400">
            Healthy (3-5)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: COLORS.borderline }}
          />
          <span className="text-gray-600 dark:text-gray-400">
            Borderline (2, 6)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: COLORS.concerning }}
          />
          <span className="text-gray-600 dark:text-gray-400">
            Concerning (1, 7)
          </span>
        </div>
      </div>
    </div>
  );
}
