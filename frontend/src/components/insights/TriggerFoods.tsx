"use client";

import { useState } from "react";
import {
  useFoodAnalysisQuery,
  FoodCorrelationResult,
} from "@/lib/api/cronometer";

// =============================================================================
// Types
// =============================================================================

export interface TriggerFoodsProps {
  startDate: string;
  endDate: string;
  enabled?: boolean;
  onFoodClick?: (food: FoodCorrelationResult) => void;
}

// =============================================================================
// TriggerFoods Component
// =============================================================================

export function TriggerFoods({
  startDate,
  endDate,
  enabled = true,
  onFoodClick,
}: TriggerFoodsProps) {
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const { data, isLoading, error } = useFoodAnalysisQuery(
    { startDate, endDate, minOccurrences: 3, timeLagHours: 24 },
    enabled
  );

  // Get severity indicator
  const getSeverityColor = (correlation: number) => {
    const absCorr = Math.abs(correlation);
    if (absCorr >= 0.4) return "bg-[#C62828]"; // Strong
    if (absCorr >= 0.25) return "bg-[#EF5350]"; // Moderate
    return "bg-[#FF8A80]"; // Weak
  };

  const getSeverityLabel = (correlation: number) => {
    const absCorr = Math.abs(correlation);
    if (absCorr >= 0.4) return "Strong";
    if (absCorr >= 0.25) return "Moderate";
    return "Weak";
  };

  // Get Bristol color
  const getBristolColor = (score: number | null) => {
    if (score === null) return "text-[#A89B86]";
    if (score >= 3 && score <= 5) return "text-[#2E7D32] dark:text-[#A8D5BA]";
    if (score === 2 || score === 6) return "text-[#F59E0B]";
    return "text-[#C62828] dark:text-[#F5A9A9]";
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
          <span className="ml-3 text-sm text-[#4A4543] dark:text-[#F5F3F0]">Analyzing triggers...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return null; // Don't show error for this component, let FoodAnalysis handle it
  }

  // No trigger foods
  if (!data?.trigger_foods || data.trigger_foods.length === 0) {
    return (
      <div className="card-hover rounded-2xl border border-[#E8F5E9] bg-[#E8F5E9]/30 p-6 shadow-sm dark:border-[#A8D5BA]/30 dark:bg-[#A8D5BA]/10">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#E8F5E9] shadow-sm dark:bg-[#A8D5BA]/20">
            <svg className="h-6 w-6 text-[#2E7D32] dark:text-[#A8D5BA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#2E7D32] dark:text-[#A8D5BA]">
              No Trigger Foods Detected
            </h2>
            <p className="mt-1 text-base text-[#4A4543] dark:text-[#F5F3F0]">
              Based on your data, no specific foods are strongly associated with poor digestive outcomes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-hover rounded-2xl border border-[#FFEBEE] bg-[#FFEBEE]/30 p-6 shadow-sm dark:border-[#F5A9A9]/30 dark:bg-[#F5A9A9]/10">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFEBEE] shadow-sm dark:bg-[#F5A9A9]/20">
            <svg className="h-6 w-6 text-[#C62828] dark:text-[#F5A9A9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#C62828] dark:text-[#F5A9A9]">
              Potential Trigger Foods ({data.trigger_foods.length})
            </h2>
            <p className="mt-1 text-base text-[#4A4543] dark:text-[#F5F3F0]">
              These foods appear more frequently before poor digestive outcomes.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowDisclaimer(!showDisclaimer)}
          className="rounded-lg p-2 text-[#A89B86] hover:bg-white/50 dark:hover:bg-[#3D3935]/50"
          title="About this analysis"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {/* Disclaimer */}
      {showDisclaimer && (
        <div className="mt-4 rounded-lg bg-white/50 p-4 text-sm text-[#4A4543] dark:bg-[#3D3935]/50 dark:text-[#F5F3F0]">
          <p className="font-medium">Important: Correlation ≠ Causation</p>
          <p className="mt-1 text-[#A89B86] dark:text-[#B8A99A]">
            This analysis shows statistical correlations, not proven cause-and-effect relationships.
            Many factors can affect digestive health. Consider these findings as starting points
            for self-experimentation, not definitive answers. Consult a healthcare provider for
            persistent digestive issues.
          </p>
        </div>
      )}

      {/* Trigger Food Cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.trigger_foods.map((food) => (
          <div
            key={food.food_name}
            onClick={() => onFoodClick?.(food)}
            className={`rounded-xl border border-[#DEDDDB] bg-white p-4 shadow-sm transition-all dark:border-[#3D3935] dark:bg-[#363230] ${
              onFoodClick ? "cursor-pointer hover:shadow-md" : ""
            }`}
          >
            <div className="flex items-start justify-between">
              <h3 className="font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                {food.food_name}
              </h3>
              <div className={`h-3 w-3 rounded-full ${getSeverityColor(food.correlation)}`} title={`${getSeverityLabel(food.correlation)} association`} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-[#A89B86] dark:text-[#B8A99A]">Times Eaten</p>
                <p className="font-medium text-[#4A4543] dark:text-[#F5F3F0]">{food.times_eaten}x</p>
              </div>
              <div>
                <p className="text-xs text-[#A89B86] dark:text-[#B8A99A]">Avg Bristol After</p>
                <p className={`font-medium ${getBristolColor(food.avg_bristol_after)}`}>
                  {food.avg_bristol_after?.toFixed(1) ?? "-"}
                </p>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className={`text-xs font-medium ${getSeverityColor(food.correlation) === "bg-[#C62828]" ? "text-[#C62828]" : "text-[#EF5350]"}`}>
                {getSeverityLabel(food.correlation)} association
              </span>
              {onFoodClick && (
                <span className="text-xs text-[#A89B86] dark:text-[#B8A99A]">
                  Click for details →
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary text */}
      <p className="mt-4 text-xs text-[#A89B86] dark:text-[#B8A99A]">
        Based on {data.total_food_logs} food logs and {data.total_bristol_events} Bristol events.
        Analysis period: {data.analysis_start_date} to {data.analysis_end_date}
      </p>
    </div>
  );
}

export default TriggerFoods;
