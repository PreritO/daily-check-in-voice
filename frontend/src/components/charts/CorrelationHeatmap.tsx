"use client";

import { useMemo, useState } from "react";
import type { CorrelationResult } from "@/lib/api/cronometer";

// =============================================================================
// Types
// =============================================================================

export interface CorrelationHeatmapProps {
  /** Correlation data grouped by time lag (e.g., { 12: [...], 24: [...], ... }) */
  correlationData: Record<number, CorrelationResult[]>;
  /** Optional callback when a cell is clicked */
  onCellClick?: (nutrientKey: string, lagHours: number) => void;
}

interface NutrientGroup {
  name: string;
  nutrients: string[];
}

interface ProcessedCell {
  nutrientKey: string;
  nutrientName: string;
  lagHours: number;
  correlation: number;
  pValue: number;
  isSignificant: boolean;
  sampleSize: number;
  direction: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: ProcessedCell | null;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Nutrient groupings for organized display
 */
const NUTRIENT_GROUPS: NutrientGroup[] = [
  {
    name: "Macros",
    nutrients: [
      "protein",
      "carbs",
      "carbohydrates",
      "fat",
      "fiber",
      "sugar",
      "calories",
      "energy",
    ],
  },
  {
    name: "Vitamins",
    nutrients: [
      "vitamin_a",
      "vitamin_b1",
      "vitamin_b2",
      "vitamin_b3",
      "vitamin_b5",
      "vitamin_b6",
      "vitamin_b7",
      "vitamin_b9",
      "vitamin_b12",
      "vitamin_c",
      "vitamin_d",
      "vitamin_e",
      "vitamin_k",
      "thiamin",
      "riboflavin",
      "niacin",
      "folate",
      "biotin",
      "pantothenic",
      "cobalamin",
    ],
  },
  {
    name: "Minerals",
    nutrients: [
      "calcium",
      "iron",
      "magnesium",
      "phosphorus",
      "potassium",
      "sodium",
      "zinc",
      "copper",
      "manganese",
      "selenium",
      "chromium",
      "iodine",
    ],
  },
];

const TIME_LAGS = [12, 24, 36, 48, 72] as const;

// Color constants
const COLORS = {
  positive: "#10b981", // Green for positive correlations
  negative: "#ef4444", // Red for negative correlations
  neutral: "#f9fafb", // Light gray for near-zero correlations
} as const;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Gets the category for a nutrient key
 */
function getNutrientCategory(nutrientKey: string): string {
  const normalizedKey = nutrientKey.toLowerCase().replace(/[-_\s]/g, "_");

  for (const group of NUTRIENT_GROUPS) {
    if (
      group.nutrients.some(
        (n) =>
          normalizedKey.includes(n) ||
          n.includes(normalizedKey) ||
          normalizedKey === n
      )
    ) {
      return group.name;
    }
  }

  return "Other";
}

/**
 * Interpolates between two colors based on a value between 0 and 1
 */
function interpolateColor(
  color1: string,
  color2: string,
  factor: number
): string {
  // Parse hex colors to RGB
  const hex1 = color1.replace("#", "");
  const hex2 = color2.replace("#", "");

  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);

  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);

  // Interpolate
  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  // Convert back to hex
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Gets the background color for a correlation value
 */
function getCorrelationColor(correlation: number): string {
  const absCorrelation = Math.abs(correlation);

  if (correlation > 0) {
    // Positive: interpolate from neutral to green
    return interpolateColor(COLORS.neutral, COLORS.positive, absCorrelation);
  } else if (correlation < 0) {
    // Negative: interpolate from neutral to red
    return interpolateColor(COLORS.neutral, COLORS.negative, absCorrelation);
  }

  return COLORS.neutral;
}

/**
 * Gets the opacity based on significance
 */
function getSignificanceOpacity(isSignificant: boolean): number {
  return isSignificant ? 1.0 : 0.5;
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
  return `${sign}${correlation.toFixed(2)}`;
}

// =============================================================================
// Component
// =============================================================================

/**
 * CorrelationHeatmap component for visualizing nutrient-Bristol correlations
 * across multiple time lags.
 *
 * Displays a heatmap grid where:
 * - Rows are nutrients grouped by category
 * - Columns are time lags (12h, 24h, 36h, 48h, 72h)
 * - Cell color indicates correlation direction and strength
 * - Cell opacity indicates statistical significance
 *
 * @example
 * ```tsx
 * <CorrelationHeatmap
 *   correlationData={apiResponse.results_by_lag}
 *   onCellClick={(nutrientKey, lagHours) => {
 *     console.log(`Clicked ${nutrientKey} at ${lagHours}h lag`);
 *   }}
 * />
 * ```
 */
export function CorrelationHeatmap({
  correlationData,
  onCellClick,
}: CorrelationHeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });

  // Process data into a structured format grouped by category
  const { groupedData, allNutrients } = useMemo(() => {
    // Build a map of all nutrients and their data across lags
    const nutrientMap = new Map<string, Map<number, ProcessedCell>>();

    for (const [lagStr, results] of Object.entries(correlationData)) {
      const lag = parseInt(lagStr, 10);

      for (const result of results) {
        if (!nutrientMap.has(result.nutrient_key)) {
          nutrientMap.set(result.nutrient_key, new Map());
        }

        nutrientMap.get(result.nutrient_key)!.set(lag, {
          nutrientKey: result.nutrient_key,
          nutrientName: result.nutrient_name,
          lagHours: lag,
          correlation: result.correlation_coefficient,
          pValue: result.p_value,
          isSignificant: result.is_significant,
          sampleSize: result.sample_size,
          direction: result.direction,
        });
      }
    }

    // Group nutrients by category
    const grouped: Record<
      string,
      Array<{ key: string; name: string; cells: Map<number, ProcessedCell> }>
    > = {
      Macros: [],
      Vitamins: [],
      Minerals: [],
      Other: [],
    };

    const allNuts: string[] = [];

    for (const [nutrientKey, cellMap] of nutrientMap) {
      const firstCell = cellMap.values().next().value;
      const nutrientName = firstCell?.nutrientName || nutrientKey;
      const category = getNutrientCategory(nutrientKey);

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push({
        key: nutrientKey,
        name: nutrientName,
        cells: cellMap,
      });

      allNuts.push(nutrientKey);
    }

    // Sort each category alphabetically by nutrient name
    for (const category of Object.keys(grouped)) {
      grouped[category].sort((a, b) => a.name.localeCompare(b.name));
    }

    return { groupedData: grouped, allNutrients: allNuts };
  }, [correlationData]);

  // Handle cell mouse events
  const handleCellMouseEnter = (
    event: React.MouseEvent,
    cell: ProcessedCell
  ) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      data: cell,
    });
  };

  const handleCellMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, data: null });
  };

  const handleCellClick = (nutrientKey: string, lagHours: number) => {
    if (onCellClick) {
      onCellClick(nutrientKey, lagHours);
    }
  };

  // Check if we have any data
  if (allNutrients.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>No correlation data available</p>
      </div>
    );
  }

  // Get categories that have nutrients
  const activeCategories = Object.entries(groupedData).filter(
    ([, nutrients]) => nutrients.length > 0
  );

  return (
    <div className="w-full relative">
      {/* Legend */}
      <div className="flex justify-between items-center mb-4 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COLORS.negative }}
            />
            <span className="text-gray-600 dark:text-gray-400">
              Negative correlation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COLORS.neutral }}
            />
            <span className="text-gray-600 dark:text-gray-400">
              No correlation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COLORS.positive }}
            />
            <span className="text-gray-600 dark:text-gray-400">
              Positive correlation
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">
              Significant (p &lt; 0.05)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-400 opacity-50" />
            <span className="text-gray-600 dark:text-gray-400">
              Not significant
            </span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Header Row */}
          <div className="grid grid-cols-[200px_repeat(5,1fr)] gap-1 mb-1">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2 py-1">
              Nutrient
            </div>
            {TIME_LAGS.map((lag) => (
              <div
                key={lag}
                className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center py-1"
              >
                {lag}h
              </div>
            ))}
          </div>

          {/* Data Rows by Category */}
          <div className="max-h-[500px] overflow-y-auto">
            {activeCategories.map(([category, nutrients]) => (
              <div key={category}>
                {/* Category Header */}
                <div className="grid grid-cols-[200px_repeat(5,1fr)] gap-1 mt-3 mb-1">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded">
                    {category}
                  </div>
                  <div className="col-span-5" />
                </div>

                {/* Nutrient Rows */}
                {nutrients.map((nutrient) => (
                  <div
                    key={nutrient.key}
                    className="grid grid-cols-[200px_repeat(5,1fr)] gap-1 mb-1"
                  >
                    {/* Nutrient Name */}
                    <div className="text-sm text-gray-700 dark:text-gray-300 px-2 py-2 truncate">
                      {nutrient.name}
                    </div>

                    {/* Cells for each time lag */}
                    {TIME_LAGS.map((lag) => {
                      const cell = nutrient.cells.get(lag);

                      if (!cell) {
                        return (
                          <div
                            key={`${nutrient.key}-${lag}`}
                            className="h-10 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400"
                          >
                            -
                          </div>
                        );
                      }

                      const bgColor = getCorrelationColor(cell.correlation);
                      const opacity = getSignificanceOpacity(cell.isSignificant);

                      return (
                        <div
                          key={`${nutrient.key}-${lag}`}
                          className="h-10 rounded flex items-center justify-center text-xs font-medium cursor-pointer transition-transform hover:scale-105 hover:z-10 hover:shadow-md"
                          style={{
                            backgroundColor: bgColor,
                            opacity,
                            color:
                              Math.abs(cell.correlation) > 0.3
                                ? "#ffffff"
                                : "#374151",
                          }}
                          onMouseEnter={(e) => handleCellMouseEnter(e, cell)}
                          onMouseLeave={handleCellMouseLeave}
                          onClick={() =>
                            handleCellClick(nutrient.key, lag)
                          }
                        >
                          {formatCorrelation(cell.correlation)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
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
            {tooltip.data.nutrientName}
          </p>
          <div className="mt-1 space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <p>
              Time lag:{" "}
              <span className="font-medium">{tooltip.data.lagHours}h</span>
            </p>
            <p>
              Correlation:{" "}
              <span
                className="font-medium"
                style={{
                  color:
                    tooltip.data.correlation > 0
                      ? COLORS.positive
                      : tooltip.data.correlation < 0
                        ? COLORS.negative
                        : undefined,
                }}
              >
                {formatCorrelation(tooltip.data.correlation)}
              </span>
            </p>
            <p>
              P-value:{" "}
              <span className="font-medium">
                {formatPValue(tooltip.data.pValue)}
              </span>
            </p>
            <p>
              Sample size:{" "}
              <span className="font-medium">{tooltip.data.sampleSize}</span>
            </p>
            <p
              className={
                tooltip.data.isSignificant
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500 dark:text-gray-500"
              }
            >
              {tooltip.data.isSignificant
                ? "Statistically significant"
                : "Not statistically significant"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
