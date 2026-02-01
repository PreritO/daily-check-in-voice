"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

// =============================================================================
// Types
// =============================================================================

export interface OptimalRange {
  nutrient_name: string;
  nutrient_key: string;
  optimal_min: number;
  optimal_max: number;
  avg_bristol_in_range: number;
  sample_size: number;
  confidence_score: number;
  unit: string;
}

export interface OptimalRangesResponse {
  total_nutrients_analyzed: number;
  total_food_logs: number;
  total_bristol_events: number;
  target_bristol: number;
  tolerance: number;
  analysis_start_date: string;
  analysis_end_date: string;
  ranges: OptimalRange[];
}

export interface OptimalRangesProps {
  startDate: string;
  endDate: string;
  enabled?: boolean;
  todaysIntake?: Record<string, number>;
}

// =============================================================================
// API Hook
// =============================================================================

async function getOptimalRanges(params: {
  startDate: string;
  endDate: string;
  targetBristol?: number;
  tolerance?: number;
}): Promise<OptimalRangesResponse> {
  const searchParams = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
  });
  if (params.targetBristol !== undefined) {
    searchParams.set("target_bristol", params.targetBristol.toString());
  }
  if (params.tolerance !== undefined) {
    searchParams.set("tolerance", params.tolerance.toString());
  }
  const response = await apiClient.get<OptimalRangesResponse>(
    `/cronometer/insights/optimal-ranges?${searchParams}`
  );
  return response.data;
}

export function useOptimalRangesQuery(
  params: { startDate: string; endDate: string; targetBristol?: number; tolerance?: number },
  enabled = true
) {
  return useQuery({
    queryKey: ["cronometer", "optimal-ranges", params],
    queryFn: () => getOptimalRanges(params),
    enabled,
  });
}

// =============================================================================
// Nutrient Categories
// =============================================================================

const NUTRIENT_CATEGORIES: Record<string, string[]> = {
  "Macronutrients": ["calories", "protein", "carbs", "fat", "fiber", "sugar"],
  "Fats": ["saturated_fat", "monounsaturated_fat", "polyunsaturated_fat", "omega_3", "omega_6", "cholesterol"],
  "Vitamins": ["vitamin_a", "vitamin_c", "vitamin_d", "vitamin_e", "vitamin_k", "vitamin_b1", "vitamin_b2", "vitamin_b3", "vitamin_b5", "vitamin_b6", "vitamin_b7", "vitamin_b9", "vitamin_b12"],
  "Minerals": ["calcium", "iron", "magnesium", "phosphorus", "potassium", "zinc", "copper", "manganese", "selenium", "chromium", "sodium"],
  "Other": ["water", "caffeine", "alcohol"],
};

function getCategoryForNutrient(nutrientKey: string): string {
  for (const [category, nutrients] of Object.entries(NUTRIENT_CATEGORIES)) {
    if (nutrients.includes(nutrientKey)) {
      return category;
    }
  }
  return "Other";
}

// =============================================================================
// Helper Components
// =============================================================================

function ConfidenceIndicator({ score }: { score: number }) {
  const level = score >= 0.8 ? "high" : score >= 0.5 ? "medium" : "low";
  const colors = {
    high: "bg-[#2E7D32] dark:bg-[#A8D5BA]",
    medium: "bg-[#F59E0B]",
    low: "bg-[#A89B86] dark:bg-[#B8A99A]",
  };
  const labels = {
    high: "High confidence",
    medium: "Moderate confidence",
    low: "Low confidence",
  };

  return (
    <div className="flex items-center gap-1.5" title={`${labels[level]} (${Math.round(score * 100)}%)`}>
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-2 w-1 rounded-full ${
              (level === "high" && i < 3) ||
              (level === "medium" && i < 2) ||
              (level === "low" && i < 1)
                ? colors[level]
                : "bg-[#DEDDDB] dark:bg-[#3D3935]"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-[#A89B86] dark:text-[#B8A99A]">
        {Math.round(score * 100)}%
      </span>
    </div>
  );
}

function RangeGauge({
  min,
  max,
  current,
  unit,
}: {
  min: number;
  max: number;
  current?: number;
  unit: string;
}) {
  // Calculate positions for the gauge (using a reasonable scale)
  const gaugeMin = Math.max(0, min * 0.5);
  const gaugeMax = max * 1.5;
  const range = gaugeMax - gaugeMin;

  const optimalStart = ((min - gaugeMin) / range) * 100;
  const optimalWidth = ((max - min) / range) * 100;
  const currentPos = current !== undefined ? ((current - gaugeMin) / range) * 100 : null;

  const isInRange = current !== undefined && current >= min && current <= max;
  const isBelowRange = current !== undefined && current < min;
  const isAboveRange = current !== undefined && current > max;

  return (
    <div className="relative mt-2">
      {/* Gauge bar */}
      <div className="relative h-3 rounded-full bg-[#DEDDDB] dark:bg-[#3D3935] overflow-hidden">
        {/* Optimal range highlight */}
        <div
          className="absolute h-full bg-[#E8F5E9] dark:bg-[#A8D5BA]/30"
          style={{
            left: `${Math.max(0, Math.min(100, optimalStart))}%`,
            width: `${Math.max(0, Math.min(100 - optimalStart, optimalWidth))}%`,
          }}
        />
        {/* Current value indicator */}
        {currentPos !== null && (
          <div
            className={`absolute top-0 bottom-0 w-1 rounded-full ${
              isInRange
                ? "bg-[#2E7D32] dark:bg-[#A8D5BA]"
                : isBelowRange || isAboveRange
                ? "bg-[#F59E0B]"
                : "bg-[#4A4543]"
            }`}
            style={{
              left: `${Math.max(0, Math.min(99, currentPos))}%`,
            }}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1 text-xs text-[#A89B86] dark:text-[#B8A99A]">
        <span>{min.toFixed(1)}{unit}</span>
        <span>{max.toFixed(1)}{unit}</span>
      </div>

      {/* Current value status */}
      {current !== undefined && (
        <div className={`mt-1 text-xs ${
          isInRange
            ? "text-[#2E7D32] dark:text-[#A8D5BA]"
            : "text-[#F59E0B]"
        }`}>
          {isInRange && "Current intake is in optimal range"}
          {isBelowRange && `Current: ${current.toFixed(1)}${unit} (below range)`}
          {isAboveRange && `Current: ${current.toFixed(1)}${unit} (above range)`}
        </div>
      )}
    </div>
  );
}

function NutrientRangeCard({
  range,
  currentIntake,
}: {
  range: OptimalRange;
  currentIntake?: number;
}) {
  return (
    <div className="rounded-xl border border-[#DEDDDB] bg-white p-4 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-[#4A4543] dark:text-[#F5F3F0]">
            {range.nutrient_name}
          </h4>
          <p className="mt-0.5 text-sm text-[#2E7D32] dark:text-[#A8D5BA] font-medium">
            {range.optimal_min.toFixed(1)} - {range.optimal_max.toFixed(1)} {range.unit}
          </p>
        </div>
        <ConfidenceIndicator score={range.confidence_score} />
      </div>

      <RangeGauge
        min={range.optimal_min}
        max={range.optimal_max}
        current={currentIntake}
        unit={range.unit}
      />

      <div className="mt-3 flex items-center gap-3 text-xs text-[#A89B86] dark:text-[#B8A99A]">
        <span>Avg Bristol: {range.avg_bristol_in_range.toFixed(1)}</span>
        <span>n={range.sample_size}</span>
      </div>
    </div>
  );
}

// =============================================================================
// OptimalRanges Component
// =============================================================================

export function OptimalRanges({
  startDate,
  endDate,
  enabled = true,
  todaysIntake,
}: OptimalRangesProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["Macronutrients"])
  );

  const { data, isLoading, error } = useOptimalRangesQuery(
    { startDate, endDate },
    enabled
  );

  // Group ranges by category
  const rangesByCategory = useMemo(() => {
    if (!data?.ranges) return {};

    const grouped: Record<string, OptimalRange[]> = {};
    for (const range of data.ranges) {
      const category = getCategoryForNutrient(range.nutrient_key);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(range);
    }

    // Sort categories by number of nutrients
    return grouped;
  }, [data?.ranges]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <div className="flex items-center justify-center py-8">
          <svg className="h-6 w-6 animate-spin text-[#E8A0BF]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-3 text-sm text-[#4A4543] dark:text-[#F5F3F0]">Analyzing optimal ranges...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="card-hover rounded-2xl border border-[#FFEBEE] bg-[#FFEBEE]/30 p-6 shadow-sm dark:border-[#F5A9A9]/30 dark:bg-[#F5A9A9]/10">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFEBEE] shadow-sm dark:bg-[#F5A9A9]/20">
            <svg className="h-6 w-6 text-[#C62828] dark:text-[#F5A9A9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#C62828] dark:text-[#F5A9A9]">
              Unable to Calculate Ranges
            </h2>
            <p className="mt-1 text-base text-[#4A4543] dark:text-[#F5F3F0]">
              Not enough data to determine optimal ranges. Try a longer date range or log more food and bowel movements.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || data.ranges.length === 0) {
    return (
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#F5F3F0] shadow-sm dark:bg-[#3D3935]">
            <svg className="h-6 w-6 text-[#A89B86]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
              No Optimal Ranges Yet
            </h2>
            <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
              Continue logging your food and bowel movements to discover your personalized optimal nutrient ranges.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card-hover rounded-2xl border border-[#E8F5E9] bg-[#E8F5E9]/30 p-6 shadow-sm dark:border-[#A8D5BA]/30 dark:bg-[#A8D5BA]/10">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#E8F5E9] shadow-sm dark:bg-[#A8D5BA]/20">
            <svg className="h-6 w-6 text-[#2E7D32] dark:text-[#A8D5BA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#2E7D32] dark:text-[#A8D5BA]">
              Your Personalized Optimal Ranges
            </h2>
            <p className="mt-1 text-base text-[#4A4543] dark:text-[#F5F3F0]">
              Based on {data.total_bristol_events} bowel movements and {data.total_food_logs} food logs,
              these are the intake ranges where your Bristol scores are closest to {data.target_bristol} (ideal).
            </p>
          </div>
        </div>
      </div>

      {/* Category Sections */}
      {Object.entries(rangesByCategory).map(([category, ranges]) => (
        <div
          key={category}
          className="rounded-2xl border border-[#DEDDDB] bg-white shadow-sm dark:border-[#3D3935] dark:bg-[#363230] overflow-hidden"
        >
          {/* Category Header */}
          <button
            onClick={() => toggleCategory(category)}
            className="flex w-full items-center justify-between p-4 hover:bg-[#F5F3F0]/50 dark:hover:bg-[#3D3935]/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <h3 className="font-serif text-lg font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
                {category}
              </h3>
              <span className="text-sm text-[#A89B86] dark:text-[#B8A99A]">
                ({ranges.length} nutrient{ranges.length !== 1 ? "s" : ""})
              </span>
            </div>
            <svg
              className={`h-5 w-5 text-[#A89B86] transition-transform ${
                expandedCategories.has(category) ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Nutrient Cards */}
          {expandedCategories.has(category) && (
            <div className="border-t border-[#DEDDDB] dark:border-[#3D3935] p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ranges.map((range) => (
                  <NutrientRangeCard
                    key={range.nutrient_key}
                    range={range}
                    currentIntake={todaysIntake?.[range.nutrient_key]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Footer */}
      <p className="text-xs text-[#A89B86] dark:text-[#B8A99A] text-center">
        Analysis period: {data.analysis_start_date} to {data.analysis_end_date}.
        Ranges are personalized to your data and may differ from general recommendations.
      </p>
    </div>
  );
}

export default OptimalRanges;
