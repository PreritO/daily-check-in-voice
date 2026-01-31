"use client";

import { useState, useMemo } from "react";

// =============================================================================
// Types
// =============================================================================

/**
 * Single Granger causality test result for a nutrient
 */
export interface GrangerResult {
  nutrient_key: string;
  nutrient_name: string;
  f_statistic: number;
  p_value: number;
  optimal_lag: number;
  is_causal: boolean;
}

/**
 * Full response from the Granger causality analysis API
 */
export interface GrangerResponse {
  start_date: string;
  end_date: string;
  nutrients_tested: number;
  causal_nutrients_count: number;
  results: GrangerResult[];
}

/**
 * Props for the GrangerResults component
 */
export interface GrangerResultsProps {
  /** Granger causality analysis data */
  data: GrangerResponse | null;
  /** Whether the data is currently loading */
  isLoading?: boolean;
  /** Error from the API request */
  error?: Error | null;
}

// =============================================================================
// Loading Skeleton Component
// =============================================================================

function GrangerSkeleton() {
  return (
    <div className="w-full animate-pulse">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-6 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>

      {/* Toggle skeleton */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>

      {/* Table header skeleton */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-5 gap-4">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
        </div>

        {/* Table rows skeleton */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
          >
            <div className="grid grid-cols-5 gap-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer skeleton */}
      <div className="mt-6">
        <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      </div>
    </div>
  );
}

// =============================================================================
// Empty State Component
// =============================================================================

function EmptyState({ message }: { message: string }) {
  return (
    <div className="w-full flex flex-col items-center justify-center py-12 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
        <svg
          className="h-8 w-8 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
        {message}
      </p>
    </div>
  );
}

// =============================================================================
// Error State Component
// =============================================================================

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="w-full flex flex-col items-center justify-center py-12 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
        <svg
          className="h-8 w-8 text-red-500 dark:text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-red-600 dark:text-red-400 text-center mb-1">
        Failed to load Granger causality results
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        {error.message}
      </p>
    </div>
  );
}

// =============================================================================
// Causal Badge Component
// =============================================================================

function CausalBadge({ isCausal }: { isCausal: boolean }) {
  if (isCausal) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <svg
          className="h-3 w-3"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        Yes
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
      <svg
        className="h-3 w-3"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
      No
    </span>
  );
}

// =============================================================================
// Disclaimer Component
// =============================================================================

function Disclaimer() {
  return (
    <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-900/20">
      <div className="flex gap-3">
        <svg
          className="h-5 w-5 flex-shrink-0 text-amber-500 dark:text-amber-400 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Statistical causation suggests predictive power, not definitive causation.
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            Consult a healthcare provider before making dietary changes.
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * GrangerResults component for displaying Granger causality test results.
 *
 * Shows a table of nutrients that may cause changes in stool consistency,
 * based on Granger causality analysis. Includes filtering to show only
 * causal nutrients by default, with an option to show all tested nutrients.
 *
 * @example
 * ```tsx
 * <GrangerResults
 *   data={grangerData}
 *   isLoading={isLoading}
 *   error={error}
 * />
 * ```
 */
export function GrangerResults({
  data,
  isLoading = false,
  error = null,
}: GrangerResultsProps) {
  const [showAll, setShowAll] = useState(false);

  // Filter results based on showAll toggle
  const filteredResults = useMemo(() => {
    if (!data?.results) return [];
    if (showAll) return data.results;
    return data.results.filter((result) => result.is_causal);
  }, [data?.results, showAll]);

  // Loading state
  if (isLoading) {
    return <GrangerSkeleton />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} />;
  }

  // No data state
  if (!data) {
    return <EmptyState message="No Granger causality data available" />;
  }

  // No causal nutrients found
  if (data.causal_nutrients_count === 0 && !showAll) {
    return (
      <div className="w-full">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            These nutrients may CAUSE changes in stool consistency
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Based on Granger causality analysis
          </p>
        </div>

        {/* Toggle */}
        <div className="mb-4">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-[#E8A0BF] focus:ring-[#E8A0BF] dark:border-gray-600 dark:bg-gray-700"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Show all tested nutrients ({data.nutrients_tested})
            </span>
          </label>
        </div>

        <EmptyState message="No nutrients showed statistically significant causal relationships. Try toggling 'Show all tested nutrients' to see all results." />

        <Disclaimer />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          These nutrients may CAUSE changes in stool consistency
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Based on Granger causality analysis
          {data.start_date && data.end_date && (
            <span>
              {" "}
              ({data.start_date} to {data.end_date})
            </span>
          )}
        </p>
      </div>

      {/* Summary stats */}
      <div className="mb-4 flex items-center gap-4 text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          <span className="font-medium text-green-600 dark:text-green-400">
            {data.causal_nutrients_count}
          </span>{" "}
          of {data.nutrients_tested} nutrients show causal relationships
        </span>
      </div>

      {/* Toggle */}
      <div className="mb-4">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#E8A0BF] focus:ring-[#E8A0BF] dark:border-gray-600 dark:bg-gray-700"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Show all tested nutrients
          </span>
        </label>
      </div>

      {/* Results table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-5 gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <div>Nutrient</div>
            <div className="text-right">F-Statistic</div>
            <div className="text-right">P-Value</div>
            <div className="text-right">Optimal Lag</div>
            <div className="text-center">Causal</div>
          </div>
        </div>

        {/* Table body */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredResults.map((result) => (
            <div
              key={result.nutrient_key}
              className={`grid grid-cols-5 gap-4 px-4 py-3 text-sm ${
                !result.is_causal
                  ? "opacity-50 bg-gray-50/50 dark:bg-gray-800/50"
                  : ""
              }`}
            >
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {result.nutrient_name}
              </div>
              <div className="text-right text-gray-600 dark:text-gray-400 tabular-nums">
                {result.f_statistic.toFixed(2)}
              </div>
              <div className="text-right text-gray-600 dark:text-gray-400 tabular-nums">
                {result.p_value < 0.0001
                  ? "< 0.0001"
                  : result.p_value.toFixed(4)}
              </div>
              <div className="text-right text-gray-600 dark:text-gray-400">
                {result.optimal_lag} {result.optimal_lag === 1 ? "day" : "days"}
              </div>
              <div className="flex justify-center">
                <CausalBadge isCausal={result.is_causal} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Showing count */}
      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Showing {filteredResults.length} of {data.results.length} results
      </div>

      {/* Disclaimer */}
      <Disclaimer />
    </div>
  );
}
