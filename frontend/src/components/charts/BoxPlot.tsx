"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer } from "recharts";

// =============================================================================
// Types
// =============================================================================

/**
 * Data point for the box plot representing nutrient intake and Bristol score
 */
export interface BoxPlotDataPoint {
  nutrientValue: number;
  bristolScore: number;
}

/**
 * Props for the BoxPlot component
 */
export interface BoxPlotProps {
  /** Array of data points to plot */
  data: BoxPlotDataPoint[];
  /** Name of the nutrient being displayed (e.g., "Fiber") */
  nutrientName: string;
  /** Time lag in hours between nutrient intake and Bristol score measurement */
  timeLagHours: number;
  /** Unit for the nutrient (e.g., "g", "mg") */
  unit?: string;
}

/**
 * Statistics for a single box in the box plot
 */
interface BoxStatistics {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
  sampleSize: number;
  minNutrient: number;
  maxNutrient: number;
}

/**
 * Processed quartile data for rendering
 */
interface QuartileData {
  label: string;
  rangeLabel: string;
  stats: BoxStatistics | null;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: QuartileData | null;
}

// =============================================================================
// Constants
// =============================================================================

// Color constants for Bristol score ranges
const COLORS = {
  healthy: "#10b981", // Green for median 3-5
  borderline: "#eab308", // Yellow for median 2 or 6
  concerning: "#ef4444", // Red for median 1 or 7
  default: "#6b7280", // Gray default
} as const;

const QUARTILE_LABELS = ["Q1", "Q2", "Q3", "Q4"] as const;
const QUARTILE_RANGES = ["0-25%", "25-50%", "50-75%", "75-100%"] as const;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculates the percentile value from a sorted array
 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  if (sortedArr.length === 1) return sortedArr[0];

  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sortedArr.length) return sortedArr[sortedArr.length - 1];
  if (lower === upper) return sortedArr[lower];

  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

/**
 * Calculates box plot statistics for an array of values
 */
function calculateBoxStatistics(
  values: number[],
  nutrientMin: number,
  nutrientMax: number
): BoxStatistics | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const q1 = percentile(sorted, 25);
  const median = percentile(sorted, 50);
  const q3 = percentile(sorted, 75);

  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  // Find whisker bounds (within 1.5 * IQR)
  const whiskerMin = sorted.find((v) => v >= lowerFence) ?? min;
  const whiskerMax = [...sorted].reverse().find((v) => v <= upperFence) ?? max;

  // Find outliers
  const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);

  return {
    min: whiskerMin,
    q1,
    median,
    q3,
    max: whiskerMax,
    outliers,
    sampleSize: values.length,
    minNutrient: nutrientMin,
    maxNutrient: nutrientMax,
  };
}

/**
 * Gets the color for a median Bristol score based on health classification
 */
function getMedianColor(median: number): string {
  const roundedMedian = Math.round(median);
  if (roundedMedian >= 3 && roundedMedian <= 5) {
    return COLORS.healthy;
  }
  if (roundedMedian === 2 || roundedMedian === 6) {
    return COLORS.borderline;
  }
  if (roundedMedian === 1 || roundedMedian === 7) {
    return COLORS.concerning;
  }
  return COLORS.default;
}

/**
 * Formats a nutrient value with appropriate precision
 */
function formatNutrientValue(value: number): string {
  if (value >= 100) {
    return Math.round(value).toString();
  }
  if (value >= 10) {
    return value.toFixed(1);
  }
  return value.toFixed(2);
}

// =============================================================================
// Component
// =============================================================================

/**
 * BoxPlot component for visualizing Bristol score distributions across
 * nutrient intake quartiles.
 *
 * Displays four box plots, one for each quartile of nutrient intake:
 * - Q1: 0-25% of intake values
 * - Q2: 25-50% of intake values
 * - Q3: 50-75% of intake values
 * - Q4: 75-100% of intake values
 *
 * Each box shows the distribution of Bristol scores for that quartile:
 * - Box: Interquartile range (25th to 75th percentile)
 * - Line: Median
 * - Whiskers: Min and max values (within 1.5 * IQR)
 * - Dots: Outliers
 *
 * Colors indicate median Bristol score health classification:
 * - Green: 3-5 (healthy)
 * - Yellow: 2 or 6 (borderline)
 * - Red: 1 or 7 (concerning)
 *
 * @example
 * ```tsx
 * <BoxPlot
 *   data={[
 *     { nutrientValue: 10, bristolScore: 4 },
 *     { nutrientValue: 25, bristolScore: 3 },
 *     { nutrientValue: 40, bristolScore: 5 },
 *   ]}
 *   nutrientName="Fiber"
 *   timeLagHours={24}
 *   unit="g"
 * />
 * ```
 */
export function BoxPlot({
  data,
  nutrientName,
  timeLagHours,
  unit = "",
}: BoxPlotProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });

  // Process data into quartiles and calculate statistics
  const quartileData = useMemo((): QuartileData[] => {
    if (data.length === 0) {
      return QUARTILE_LABELS.map((label, i) => ({
        label,
        rangeLabel: QUARTILE_RANGES[i],
        stats: null,
      }));
    }

    // Sort by nutrient value to find quartile boundaries
    const sortedByNutrient = [...data].sort(
      (a, b) => a.nutrientValue - b.nutrientValue
    );
    const nutrientValues = sortedByNutrient.map((d) => d.nutrientValue);

    // Calculate quartile boundaries for nutrient values
    const q1Boundary = percentile(nutrientValues, 25);
    const q2Boundary = percentile(nutrientValues, 50);
    const q3Boundary = percentile(nutrientValues, 75);
    const minNutrient = nutrientValues[0];
    const maxNutrient = nutrientValues[nutrientValues.length - 1];

    // Group data points by quartile
    const quartileGroups: BoxPlotDataPoint[][] = [[], [], [], []];

    for (const point of data) {
      if (point.nutrientValue <= q1Boundary) {
        quartileGroups[0].push(point);
      } else if (point.nutrientValue <= q2Boundary) {
        quartileGroups[1].push(point);
      } else if (point.nutrientValue <= q3Boundary) {
        quartileGroups[2].push(point);
      } else {
        quartileGroups[3].push(point);
      }
    }

    // Calculate nutrient ranges for each quartile
    const nutrientRanges = [
      { min: minNutrient, max: q1Boundary },
      { min: q1Boundary, max: q2Boundary },
      { min: q2Boundary, max: q3Boundary },
      { min: q3Boundary, max: maxNutrient },
    ];

    // Calculate statistics for each quartile
    return QUARTILE_LABELS.map((label, i) => {
      const bristolScores = quartileGroups[i].map((d) => d.bristolScore);
      const stats = calculateBoxStatistics(
        bristolScores,
        nutrientRanges[i].min,
        nutrientRanges[i].max
      );

      const rangeLabel = `${formatNutrientValue(nutrientRanges[i].min)}-${formatNutrientValue(nutrientRanges[i].max)}${unit}`;

      return {
        label,
        rangeLabel,
        stats,
      };
    });
  }, [data, unit]);

  // Handle mouse events for tooltip
  const handleMouseEnter = (
    event: React.MouseEvent,
    quartile: QuartileData
  ) => {
    const rect = (event.target as SVGElement).getBoundingClientRect();
    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      data: quartile,
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, data: null });
  };

  // Empty state
  if (data.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>No data available for this nutrient</p>
      </div>
    );
  }

  // SVG dimensions and margins
  const margin = { top: 20, right: 30, bottom: 60, left: 50 };

  return (
    <div className="w-full">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">
        Time lag: {timeLagHours} hours between intake and Bristol score
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <svg viewBox="0 0 400 280" preserveAspectRatio="xMidYMid meet">
            {/* Background */}
            <rect
              x={margin.left}
              y={margin.top}
              width={400 - margin.left - margin.right}
              height={280 - margin.top - margin.bottom}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="1"
            />

            {/* Grid lines for Y-axis (Bristol scores 1-7) */}
            {[1, 2, 3, 4, 5, 6, 7].map((score) => {
              const y =
                margin.top +
                ((7 - score) / 6) * (280 - margin.top - margin.bottom);
              return (
                <g key={score}>
                  <line
                    x1={margin.left}
                    y1={y}
                    x2={400 - margin.right}
                    y2={y}
                    stroke="#e5e7eb"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={margin.left - 10}
                    y={y}
                    textAnchor="end"
                    alignmentBaseline="middle"
                    className="text-xs fill-gray-500"
                    fontSize="11"
                  >
                    {score}
                  </text>
                </g>
              );
            })}

            {/* Y-axis label */}
            <text
              x={15}
              y={(280 - margin.top - margin.bottom) / 2 + margin.top}
              textAnchor="middle"
              transform={`rotate(-90, 15, ${(280 - margin.top - margin.bottom) / 2 + margin.top})`}
              className="text-xs fill-gray-600"
              fontSize="12"
            >
              Bristol Score
            </text>

            {/* Healthy range shading (Bristol 3-5) */}
            <rect
              x={margin.left}
              y={margin.top + (2 / 6) * (280 - margin.top - margin.bottom)}
              width={400 - margin.left - margin.right}
              height={(2 / 6) * (280 - margin.top - margin.bottom)}
              fill={COLORS.healthy}
              fillOpacity="0.1"
            />

            {/* Box plots for each quartile */}
            {quartileData.map((quartile, i) => {
              const boxWidth = 40;
              const gap =
                (400 - margin.left - margin.right - 4 * boxWidth) / 5;
              const x = margin.left + gap + i * (boxWidth + gap);
              const centerX = x + boxWidth / 2;

              // Scale function for Bristol scores (1-7) to Y position
              const scaleY = (score: number) =>
                margin.top +
                ((7 - score) / 6) * (280 - margin.top - margin.bottom);

              if (!quartile.stats) {
                // No data for this quartile
                return (
                  <g key={quartile.label}>
                    <text
                      x={centerX}
                      y={280 - margin.bottom + 15}
                      textAnchor="middle"
                      className="text-xs fill-gray-600"
                      fontSize="11"
                    >
                      {quartile.label}
                    </text>
                    <text
                      x={centerX}
                      y={280 - margin.bottom + 30}
                      textAnchor="middle"
                      className="text-xs fill-gray-400"
                      fontSize="9"
                    >
                      No data
                    </text>
                  </g>
                );
              }

              const { min, q1, median, q3, max, outliers, sampleSize } =
                quartile.stats;
              const color = getMedianColor(median);

              // Calculate positions
              const yMin = scaleY(min);
              const yQ1 = scaleY(q1);
              const yMedian = scaleY(median);
              const yQ3 = scaleY(q3);
              const yMax = scaleY(max);

              return (
                <g key={quartile.label}>
                  {/* Whisker line (min to max) */}
                  <line
                    x1={centerX}
                    y1={yMin}
                    x2={centerX}
                    y2={yMax}
                    stroke={color}
                    strokeWidth="1.5"
                  />

                  {/* Min whisker cap */}
                  <line
                    x1={centerX - 10}
                    y1={yMin}
                    x2={centerX + 10}
                    y2={yMin}
                    stroke={color}
                    strokeWidth="1.5"
                  />

                  {/* Max whisker cap */}
                  <line
                    x1={centerX - 10}
                    y1={yMax}
                    x2={centerX + 10}
                    y2={yMax}
                    stroke={color}
                    strokeWidth="1.5"
                  />

                  {/* Box (Q1 to Q3) */}
                  <rect
                    x={x}
                    y={yQ3}
                    width={boxWidth}
                    height={yQ1 - yQ3}
                    fill={color}
                    fillOpacity="0.3"
                    stroke={color}
                    strokeWidth="2"
                    rx="2"
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    onMouseEnter={(e) => handleMouseEnter(e, quartile)}
                    onMouseLeave={handleMouseLeave}
                  />

                  {/* Median line */}
                  <line
                    x1={x}
                    y1={yMedian}
                    x2={x + boxWidth}
                    y2={yMedian}
                    stroke={color}
                    strokeWidth="3"
                  />

                  {/* Outliers */}
                  {outliers.map((outlier, j) => (
                    <circle
                      key={j}
                      cx={centerX}
                      cy={scaleY(outlier)}
                      r="3"
                      fill="none"
                      stroke={color}
                      strokeWidth="1.5"
                    />
                  ))}

                  {/* X-axis labels */}
                  <text
                    x={centerX}
                    y={280 - margin.bottom + 15}
                    textAnchor="middle"
                    className="text-xs fill-gray-700 dark:fill-gray-300"
                    fontSize="11"
                    fontWeight="500"
                  >
                    {quartile.label}
                  </text>
                  <text
                    x={centerX}
                    y={280 - margin.bottom + 28}
                    textAnchor="middle"
                    className="text-xs fill-gray-500"
                    fontSize="9"
                  >
                    {quartile.rangeLabel}
                  </text>
                  <text
                    x={centerX}
                    y={280 - margin.bottom + 40}
                    textAnchor="middle"
                    className="text-xs fill-gray-400"
                    fontSize="9"
                  >
                    n={sampleSize}
                  </text>
                </g>
              );
            })}

            {/* X-axis label */}
            <text
              x={(400 - margin.left - margin.right) / 2 + margin.left}
              y={280 - 5}
              textAnchor="middle"
              className="text-xs fill-gray-600"
              fontSize="12"
            >
              {nutrientName} Intake Quartile
            </text>
          </svg>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
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

      {/* Tooltip */}
      {tooltip.visible && tooltip.data && tooltip.data.stats && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {tooltip.data.label}: {tooltip.data.rangeLabel}
          </p>
          <div className="mt-1 space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <p>
              Sample size:{" "}
              <span className="font-medium">{tooltip.data.stats.sampleSize}</span>
            </p>
            <p>
              Median:{" "}
              <span
                className="font-medium"
                style={{ color: getMedianColor(tooltip.data.stats.median) }}
              >
                {tooltip.data.stats.median.toFixed(1)}
              </span>
            </p>
            <p>
              IQR:{" "}
              <span className="font-medium">
                {tooltip.data.stats.q1.toFixed(1)} -{" "}
                {tooltip.data.stats.q3.toFixed(1)}
              </span>
            </p>
            <p>
              Range:{" "}
              <span className="font-medium">
                {tooltip.data.stats.min.toFixed(1)} -{" "}
                {tooltip.data.stats.max.toFixed(1)}
              </span>
            </p>
            {tooltip.data.stats.outliers.length > 0 && (
              <p>
                Outliers:{" "}
                <span className="font-medium">
                  {tooltip.data.stats.outliers.length}
                </span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
