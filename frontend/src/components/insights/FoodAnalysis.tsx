"use client";

import { useState, useMemo } from "react";
import {
  useFoodAnalysisQuery,
  FoodCorrelationResult,
  FoodAnalysisResponse,
} from "@/lib/api/cronometer";

// =============================================================================
// Types
// =============================================================================

export interface FoodAnalysisProps {
  startDate: string;
  endDate: string;
  enabled?: boolean;
  onFoodClick?: (food: FoodCorrelationResult) => void;
}

type SortField = "food_name" | "times_eaten" | "avg_bristol_after" | "correlation" | "p_value";
type SortDirection = "asc" | "desc";

// =============================================================================
// FoodAnalysis Component
// =============================================================================

export function FoodAnalysis({
  startDate,
  endDate,
  enabled = true,
  onFoodClick,
}: FoodAnalysisProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showTriggersOnly, setShowTriggersOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>("correlation");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [minOccurrences, setMinOccurrences] = useState(3);
  const [timeLagHours, setTimeLagHours] = useState(24);

  const { data, isLoading, error } = useFoodAnalysisQuery(
    { startDate, endDate, minOccurrences, timeLagHours },
    enabled
  );

  // Filter and sort results
  const filteredResults = useMemo(() => {
    if (!data?.results) return [];

    let results = [...data.results];

    // Filter by trigger status
    if (showTriggersOnly) {
      results = results.filter((r) => r.is_trigger);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter((r) => r.food_name.toLowerCase().includes(query));
    }

    // Sort
    results.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortField === "food_name") {
        aVal = a.food_name.toLowerCase();
        bVal = b.food_name.toLowerCase();
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (sortField === "correlation") {
        aVal = Math.abs(a.correlation);
        bVal = Math.abs(b.correlation);
      } else if (sortField === "avg_bristol_after") {
        aVal = a.avg_bristol_after ?? 0;
        bVal = b.avg_bristol_after ?? 0;
      } else {
        aVal = a[sortField] ?? 0;
        bVal = b[sortField] ?? 0;
      }

      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });

    return results;
  }, [data, showTriggersOnly, searchQuery, sortField, sortDirection]);

  // Handle sort click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Get sort indicator
  const getSortIndicator = (field: SortField): string => {
    if (sortField !== field) return "";
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  // Get row color based on trigger status and correlation
  const getRowClass = (food: FoodCorrelationResult) => {
    if (food.is_trigger) {
      return "bg-[#FFEBEE]/50 dark:bg-[#F5A9A9]/10";
    }
    if (food.is_significant && food.correlation > 0.1) {
      return "bg-[#E8F5E9]/50 dark:bg-[#A8D5BA]/10";
    }
    return "";
  };

  // Get correlation color
  const getCorrelationColor = (correlation: number): string => {
    if (Math.abs(correlation) < 0.1) return "text-[#A89B86] dark:text-[#B8A99A]";
    if (correlation > 0) return "text-[#2E7D32] dark:text-[#A8D5BA]";
    return "text-[#C62828] dark:text-[#F5A9A9]";
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
        <div className="flex items-center justify-center py-12">
          <svg className="h-8 w-8 animate-spin text-[#E8A0BF]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-3 text-[#4A4543] dark:text-[#F5F3F0]">Analyzing foods...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <div className="rounded-lg bg-[#FFEBEE] p-4 text-sm text-[#C62828] dark:bg-[#F5A9A9]/20 dark:text-[#F5A9A9]">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Failed to analyze foods. Make sure you have enough data logged.</span>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || data.results.length === 0) {
    return (
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FEF3C7] dark:bg-[#FCD34D]/20">
            <svg className="h-8 w-8 text-[#F59E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="mt-4 font-serif text-lg font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            Not enough data
          </h3>
          <p className="mt-2 text-center text-[#A89B86] dark:text-[#B8A99A]">
            Need more food logs and Bristol events to analyze food correlations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
      <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
        Food Analysis
      </h2>
      <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
        Correlation between specific foods and Bristol outcomes.
      </p>

      {/* Summary Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-[#FDFBF7] p-3 dark:bg-[#3D3935]/50">
          <p className="text-xs text-[#A89B86] dark:text-[#B8A99A]">Foods Analyzed</p>
          <p className="mt-1 text-lg font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            {data.total_foods_analyzed}
          </p>
        </div>
        <div className="rounded-lg bg-[#FDFBF7] p-3 dark:bg-[#3D3935]/50">
          <p className="text-xs text-[#A89B86] dark:text-[#B8A99A]">Food Logs</p>
          <p className="mt-1 text-lg font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            {data.total_food_logs}
          </p>
        </div>
        <div className="rounded-lg bg-[#FDFBF7] p-3 dark:bg-[#3D3935]/50">
          <p className="text-xs text-[#A89B86] dark:text-[#B8A99A]">Trigger Foods</p>
          <p className="mt-1 text-lg font-semibold text-[#C62828] dark:text-[#F5A9A9]">
            {data.trigger_foods.length}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search foods..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-2 text-sm text-[#4A4543] shadow-sm focus:border-[#E8A0BF] focus:outline-none dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
          />
        </div>

        {/* Trigger Filter */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showTriggersOnly}
            onChange={(e) => setShowTriggersOnly(e.target.checked)}
            className="h-4 w-4 rounded border-[#DEDDDB] text-[#E8A0BF] focus:ring-[#E8A0BF]"
          />
          <span className="text-sm text-[#4A4543] dark:text-[#F5F3F0]">
            Show triggers only
          </span>
        </label>

        {/* Min Occurrences */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-[#A89B86] dark:text-[#B8A99A]">Min eaten:</label>
          <select
            value={minOccurrences}
            onChange={(e) => setMinOccurrences(Number(e.target.value))}
            className="rounded-lg border border-[#DEDDDB] bg-white px-2 py-1 text-sm dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
          >
            {[2, 3, 5, 7, 10].map((n) => (
              <option key={n} value={n}>{n}x</option>
            ))}
          </select>
        </div>

        {/* Time Lag */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-[#A89B86] dark:text-[#B8A99A]">Time lag:</label>
          <select
            value={timeLagHours}
            onChange={(e) => setTimeLagHours(Number(e.target.value))}
            className="rounded-lg border border-[#DEDDDB] bg-white px-2 py-1 text-sm dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
          >
            {[12, 24, 36, 48, 72].map((h) => (
              <option key={h} value={h}>{h}h</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#DEDDDB] dark:border-[#3D3935]">
              <th
                className="cursor-pointer p-3 text-left text-sm font-medium text-[#A89B86] hover:text-[#4A4543] dark:text-[#B8A99A]"
                onClick={() => handleSort("food_name")}
              >
                Food{getSortIndicator("food_name")}
              </th>
              <th
                className="cursor-pointer p-3 text-right text-sm font-medium text-[#A89B86] hover:text-[#4A4543] dark:text-[#B8A99A]"
                onClick={() => handleSort("times_eaten")}
              >
                Times Eaten{getSortIndicator("times_eaten")}
              </th>
              <th
                className="cursor-pointer p-3 text-right text-sm font-medium text-[#A89B86] hover:text-[#4A4543] dark:text-[#B8A99A]"
                onClick={() => handleSort("avg_bristol_after")}
              >
                Avg Bristol{getSortIndicator("avg_bristol_after")}
              </th>
              <th
                className="cursor-pointer p-3 text-right text-sm font-medium text-[#A89B86] hover:text-[#4A4543] dark:text-[#B8A99A]"
                onClick={() => handleSort("correlation")}
              >
                Correlation{getSortIndicator("correlation")}
              </th>
              <th className="p-3 text-center text-sm font-medium text-[#A89B86] dark:text-[#B8A99A]">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.map((food) => (
              <tr
                key={food.food_name}
                className={`border-b border-[#DEDDDB]/50 dark:border-[#3D3935]/50 ${getRowClass(food)} ${onFoodClick ? "cursor-pointer hover:bg-[#F5F3F0] dark:hover:bg-[#3D3935]" : ""}`}
                onClick={() => onFoodClick?.(food)}
              >
                <td className="p-3 text-sm text-[#4A4543] dark:text-[#F5F3F0]">
                  {food.food_name}
                </td>
                <td className="p-3 text-right text-sm text-[#4A4543] dark:text-[#F5F3F0]">
                  {food.times_eaten}
                </td>
                <td className={`p-3 text-right text-sm font-medium ${getBristolColor(food.avg_bristol_after)}`}>
                  {food.avg_bristol_after?.toFixed(1) ?? "-"}
                </td>
                <td className={`p-3 text-right text-sm font-medium ${getCorrelationColor(food.correlation)}`}>
                  {food.correlation.toFixed(3)}
                </td>
                <td className="p-3 text-center">
                  {food.is_trigger ? (
                    <span className="inline-flex items-center rounded-full bg-[#FFEBEE] px-2 py-1 text-xs font-medium text-[#C62828] dark:bg-[#F5A9A9]/20 dark:text-[#F5A9A9]">
                      Trigger
                    </span>
                  ) : food.is_significant ? (
                    <span className="inline-flex items-center rounded-full bg-[#E8F5E9] px-2 py-1 text-xs font-medium text-[#2E7D32] dark:bg-[#A8D5BA]/20 dark:text-[#A8D5BA]">
                      Significant
                    </span>
                  ) : (
                    <span className="text-[#A89B86] dark:text-[#B8A99A]">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredResults.length === 0 && (
          <div className="py-8 text-center text-[#A89B86] dark:text-[#B8A99A]">
            No foods match your filters
          </div>
        )}
      </div>
    </div>
  );
}

export default FoodAnalysis;
