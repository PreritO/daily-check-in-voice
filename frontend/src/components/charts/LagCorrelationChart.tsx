"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { CorrelationResult } from "@/lib/api/cronometer";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the LagCorrelationChart component
 */
export interface LagCorrelationChartProps {
  /** The nutrient key to display (e.g., "fiber_g") */
  nutrientKey: string;
  /** Human-readable nutrient name (e.g., "Fiber") */
  nutrientName: string;
  /** Correlation data grouped by time lag (e.g., { 12: [...], 24: [...], ... }) */
  correlationsByLag: Record<number, CorrelationResult[]>;
}

/**
 * Processed data point for the bar chart
 */
interface LagDataPoint {
  lag: number;
  lagLabel: string;
  correlation: number;
  pValue: number;
  sampleSize: number;
  isSignificant: boolean;
  direction: string;
  isOptimal: boolean;
}

/**
 * Custom tooltip payload type
 */
interface TooltipPayload {
  payload: LagDataPoint;
}

// =============================================================================
// Constants
// =============================================================================

const TIME_LAGS = [12, 24, 36, 48, 72] as const;

const COLORS = {
  positive: "#10b981", // Green for positive correlations
  negative: "#ef4444", // Red for negative correlations
  neutral: "#9ca3af", // Gray for zero/near-zero
  optimal: "#fbbf24", // Yellow/gold for optimal marker
} as const;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Gets the bar color based on correlation direction
 */
function getBarColor(correlation: number): string {
  if (correlation > 0) {
    return COLORS.positive;
  }
  if (correlation < 0) {
    return COLORS.negative;
  }
  return COLORS.neutral;
}

/**
 * Gets the bar opacity based on significance
 */
function getBarOpacity(isSignificant: boolean): number {
  return isSignificant ? 1.0 : 0.4;
}

/**
 * Formats a p-value for display
 */
function formatPValue(pValue: number): string {
  if (pValue < 0.001) {
    return "< 0.001";
  }
  if (pValue < 0.01) {
    return pValue.toFixed(3);
  }
  return pValue.toFixed(2);
}

/**
 * Formats a correlation coefficient for display
 */
function formatCorrelation(correlation: number): string {
  const sign = correlation >= 0 ? "+" : "";
  return `${sign}${correlation.toFixed(3)}`;
}

// =============================================================================
// Custom Tooltip Component
// =============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {data.lagLabel} Time Lag
      </p>
      <div className="mt-1 space-y-1 text-sm text-gray-600 dark:text-gray-400">
        <p>
          Correlation:{" "}
          <span
            className="font-medium"
            style={{
              color:
                data.correlation > 0
                  ? COLORS.positive
                  : data.correlation < 0
                    ? COLORS.negative
                    : undefined,
            }}
          >
            {formatCorrelation(data.correlation)}
          </span>
        </p>
        <p>
          P-value:{" "}
          <span className="font-medium">{formatPValue(data.pValue)}</span>
        </p>
        <p>
          Sample size:{" "}
          <span className="font-medium">{data.sampleSize}</span>
        </p>
        <p
          className={
            data.isSignificant
              ? "text-green-600 dark:text-green-400"
              : "text-gray-500 dark:text-gray-500"
          }
        >
          {data.isSignificant
            ? "Statistically significant (p < 0.05)"
            : "Not statistically significant"}
        </p>
        {data.isOptimal && (
          <p className="text-amber-500 font-medium">
            Optimal lag (strongest significant correlation)
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

/**
 * LagCorrelationChart component for visualizing how a single nutrient's
 * correlation with Bristol scores varies across different time lags.
 *
 * Displays a bar chart where:
 * - X-axis shows time lags (12h, 24h, 36h, 48h, 72h)
 * - Y-axis shows correlation coefficient (-1 to +1)
 * - Bar color indicates direction (green=positive, red=negative)
 * - Bar opacity indicates significance (solid=significant, faded=not)
 * - The optimal lag (strongest significant correlation) is marked with a star
 *
 * @example
 * ```tsx
 * <LagCorrelationChart
 *   nutrientKey="fiber_g"
 *   nutrientName="Fiber"
 *   correlationsByLag={apiResponse.results_by_lag}
 * />
 * ```
 */
export function LagCorrelationChart({
  nutrientKey,
  nutrientName,
  correlationsByLag,
}: LagCorrelationChartProps) {
  // Process data to find the nutrient's correlation at each lag
  const { chartData, hasData, optimalLag } = useMemo(() => {
    const dataPoints: LagDataPoint[] = [];
    let maxAbsSignificantCorrelation = 0;
    let optimalLagHours: number | null = null;

    // First pass: collect data and find optimal lag
    for (const lag of TIME_LAGS) {
      const lagResults = correlationsByLag[lag] || [];
      const result = lagResults.find((r) => r.nutrient_key === nutrientKey);

      if (result) {
        const absCorrelation = Math.abs(result.correlation_coefficient);

        // Track the strongest significant correlation
        if (result.is_significant && absCorrelation > maxAbsSignificantCorrelation) {
          maxAbsSignificantCorrelation = absCorrelation;
          optimalLagHours = lag;
        }
      }
    }

    // Second pass: build chart data with optimal flag
    for (const lag of TIME_LAGS) {
      const lagResults = correlationsByLag[lag] || [];
      const result = lagResults.find((r) => r.nutrient_key === nutrientKey);

      if (result) {
        dataPoints.push({
          lag,
          lagLabel: `${lag}h`,
          correlation: result.correlation_coefficient,
          pValue: result.p_value,
          sampleSize: result.sample_size,
          isSignificant: result.is_significant,
          direction: result.direction,
          isOptimal: lag === optimalLagHours,
        });
      } else {
        // Add placeholder for missing lag data
        dataPoints.push({
          lag,
          lagLabel: `${lag}h`,
          correlation: 0,
          pValue: 1,
          sampleSize: 0,
          isSignificant: false,
          direction: "none",
          isOptimal: false,
        });
      }
    }

    return {
      chartData: dataPoints,
      hasData: dataPoints.some((d) => d.sampleSize > 0),
      optimalLag: optimalLagHours,
    };
  }, [nutrientKey, correlationsByLag]);

  // Empty state: no data at all
  if (Object.keys(correlationsByLag).length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>No correlation data available</p>
      </div>
    );
  }

  // Empty state: nutrient not found in any lag
  if (!hasData) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <p className="font-medium">{nutrientName}</p>
          <p className="text-sm mt-1">No correlation data available for this nutrient</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Title */}
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {nutrientName} - Correlation by Time Lag
        </h3>
        {optimalLag && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
            Optimal lag: {optimalLag} hours
          </p>
        )}
      </div>

      {/* Chart */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e5e7eb"
            />

            <XAxis
              dataKey="lagLabel"
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickLine={{ stroke: "#d1d5db" }}
              axisLine={{ stroke: "#d1d5db" }}
              label={{
                value: "Time Lag",
                position: "bottom",
                offset: 15,
                fill: "#6b7280",
                fontSize: 12,
              }}
            />

            <YAxis
              domain={[-1, 1]}
              ticks={[-1, -0.5, -0.3, 0, 0.3, 0.5, 1]}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              tickLine={{ stroke: "#d1d5db" }}
              axisLine={{ stroke: "#d1d5db" }}
              label={{
                value: "Correlation (r)",
                angle: -90,
                position: "insideLeft",
                offset: 10,
                fill: "#6b7280",
                fontSize: 12,
              }}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Reference line at r=0 */}
            <ReferenceLine
              y={0}
              stroke="#9ca3af"
              strokeWidth={1.5}
            />

            {/* Optional: Reference lines at weak correlation thresholds */}
            <ReferenceLine
              y={0.3}
              stroke="#d1d5db"
              strokeDasharray="5 5"
              strokeWidth={1}
            />
            <ReferenceLine
              y={-0.3}
              stroke="#d1d5db"
              strokeDasharray="5 5"
              strokeWidth={1}
            />

            <Bar
              dataKey="correlation"
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBarColor(entry.correlation)}
                  fillOpacity={getBarOpacity(entry.isSignificant)}
                  stroke={entry.isSignificant ? getBarColor(entry.correlation) : "#9ca3af"}
                  strokeWidth={entry.isSignificant ? 2 : 1}
                  strokeDasharray={entry.isSignificant ? "0" : "4 2"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Optimal lag marker (star badge) */}
      {optimalLag && (
        <div className="flex justify-center mt-2">
          <div className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded">
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>Optimal Lag: {optimalLag}h</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div
            className="w-4 h-3 rounded"
            style={{ backgroundColor: COLORS.positive }}
          />
          <span className="text-gray-600 dark:text-gray-400">
            Positive correlation
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-4 h-3 rounded"
            style={{ backgroundColor: COLORS.negative }}
          />
          <span className="text-gray-600 dark:text-gray-400">
            Negative correlation
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-4 h-3 rounded border-2"
            style={{ backgroundColor: COLORS.positive, opacity: 1 }}
          />
          <span className="text-gray-600 dark:text-gray-400">
            Significant (p &lt; 0.05)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-4 h-3 rounded border border-dashed"
            style={{ backgroundColor: COLORS.positive, opacity: 0.4, borderColor: "#9ca3af" }}
          />
          <span className="text-gray-600 dark:text-gray-400">
            Not significant
          </span>
        </div>
      </div>
    </div>
  );
}
