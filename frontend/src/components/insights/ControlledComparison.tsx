"use client";

import { useState } from "react";

// =============================================================================
// Types
// =============================================================================

/**
 * Result from the controlled comparison analysis
 */
export interface ComparisonResult {
  nutrient_key: string;
  nutrient_name: string;
  avg_bristol_high_intake: number;
  avg_bristol_low_intake: number;
  difference: number;
  confidence_interval_low: number;
  confidence_interval_high: number;
  high_intake_count: number;
  low_intake_count: number;
  matched_pairs_count: number;
  is_significant: boolean;
}

/**
 * Props for the ControlledComparison component
 */
export interface ControlledComparisonProps {
  /** Comparison result data */
  data: ComparisonResult | null;
  /** Whether the data is currently loading */
  isLoading?: boolean;
  /** Error from the API request */
  error?: Error | null;
  /** Callback when nutrient selection changes */
  onNutrientChange?: (nutrientKey: string) => void;
  /** Currently selected nutrient key */
  selectedNutrient?: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Available nutrients for selection
 */
const NUTRIENT_OPTIONS = [
  { key: "fiber", label: "Fiber" },
  { key: "protein", label: "Protein" },
  { key: "carbs", label: "Carbohydrates" },
  { key: "fat", label: "Fat" },
  { key: "sugar", label: "Sugar" },
  { key: "calcium", label: "Calcium" },
  { key: "magnesium", label: "Magnesium" },
  { key: "iron", label: "Iron" },
  { key: "vitamin_c", label: "Vitamin C" },
] as const;

/**
 * Color constants for Bristol score ranges
 */
const COLORS = {
  healthy: "#10b981", // Green for scores 3-5
  borderline: "#eab308", // Yellow for scores 2 or 6
  concerning: "#ef4444", // Red for scores 1 or 7
  default: "#6b7280", // Gray default
} as const;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Gets the color for a Bristol score based on health classification
 */
function getBristolColor(score: number): string {
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
  return COLORS.default;
}

/**
 * Gets the background color class for a Bristol score
 */
function getBristolBgClass(score: number): string {
  const roundedScore = Math.round(score);
  if (roundedScore >= 3 && roundedScore <= 5) {
    return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
  }
  if (roundedScore === 2 || roundedScore === 6) {
    return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
  }
  if (roundedScore === 1 || roundedScore === 7) {
    return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
  }
  return "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700";
}

/**
 * Determines if a higher Bristol score is "better" (closer to 4)
 * Returns true if high intake is better, false if low intake is better
 */
function isHighIntakeBetter(highAvg: number, lowAvg: number): boolean {
  const highDistance = Math.abs(highAvg - 4);
  const lowDistance = Math.abs(lowAvg - 4);
  return highDistance < lowDistance;
}

// =============================================================================
// Loading Skeleton Component
// =============================================================================

function ComparisonSkeleton() {
  return (
    <div className="w-full animate-pulse">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-6 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>

      {/* Nutrient selector skeleton */}
      <div className="mb-6">
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>

      {/* Comparison cards skeleton */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>

      {/* Significance badge skeleton */}
      <div className="flex justify-center">
        <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded-full" />
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
        Failed to load comparison results
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        {error.message}
      </p>
    </div>
  );
}

// =============================================================================
// Significance Badge Component
// =============================================================================

function SignificanceBadge({ isSignificant }: { isSignificant: boolean }) {
  if (isSignificant) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <svg
            className="h-4 w-4"
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
          Statistically Significant
        </span>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-xs">
          The difference is unlikely to be due to chance (p &lt; 0.05)
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
        <svg
          className="h-4 w-4"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        Not Statistically Significant
      </span>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-xs">
        More data needed to determine if this pattern is reliable
      </p>
    </div>
  );
}

// =============================================================================
// Bristol Score Card Component
// =============================================================================

interface BristolCardProps {
  title: string;
  avgScore: number;
  sampleSize: number;
}

function BristolCard({ title, avgScore, sampleSize }: BristolCardProps) {
  const bgClass = getBristolBgClass(avgScore);
  const textColor = getBristolColor(avgScore);

  return (
    <div className={`rounded-lg border p-4 ${bgClass}`}>
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
        {title}
      </h4>
      <div className="text-center">
        <p
          className="text-4xl font-bold tabular-nums"
          style={{ color: textColor }}
        >
          {avgScore.toFixed(1)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Average Bristol Score
        </p>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          n = {sampleSize} days
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Difference Indicator Component
// =============================================================================

interface DifferenceIndicatorProps {
  difference: number;
  confidenceLow: number;
  confidenceHigh: number;
  highIntakeAvg: number;
  lowIntakeAvg: number;
}

function DifferenceIndicator({
  difference,
  confidenceLow,
  confidenceHigh,
  highIntakeAvg,
  lowIntakeAvg,
}: DifferenceIndicatorProps) {
  const isBetter = isHighIntakeBetter(highIntakeAvg, lowIntakeAvg);
  const arrowUp = difference > 0;
  const indicatorColor = isBetter ? COLORS.healthy : COLORS.concerning;

  return (
    <div className="flex flex-col items-center justify-center h-full">
      {/* Arrow */}
      <div
        className="flex items-center justify-center w-12 h-12 rounded-full mb-2"
        style={{ backgroundColor: `${indicatorColor}20` }}
      >
        {arrowUp ? (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke={indicatorColor}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 15l7-7 7 7"
            />
          </svg>
        ) : (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke={indicatorColor}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </div>

      {/* Difference value */}
      <p
        className="text-xl font-bold tabular-nums"
        style={{ color: indicatorColor }}
      >
        {difference > 0 ? "+" : ""}
        {difference.toFixed(2)}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Difference</p>

      {/* Confidence interval */}
      <div className="mt-3 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">95% CI</p>
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">
          [{confidenceLow.toFixed(2)}, {confidenceHigh.toFixed(2)}]
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Methodology Collapsible Component
// =============================================================================

function MethodologySection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          How this works
        </span>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="px-4 py-3 bg-white dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400 space-y-3">
          <div>
            <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quartile-Based Comparison
            </h5>
            <p>
              We split your days into high and low intake groups based on
              nutrient quartiles. High intake days are in the top 25% (Q4), while
              low intake days are in the bottom 25% (Q1).
            </p>
          </div>

          <div>
            <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-1">
              Matched Pairs Approach
            </h5>
            <p>
              To control for confounding factors, we match high and low intake
              days that are similar in other respects (e.g., similar overall
              calorie intake, same day of week). This helps isolate the effect of
              the specific nutrient.
            </p>
          </div>

          <div>
            <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-1">
              What the Numbers Mean
            </h5>
            <p>
              The average Bristol scores shown are for each group. A Bristol score
              of 3-5 is considered healthy. The difference tells you how much
              higher or lower the score is on high intake days compared to low
              intake days.
            </p>
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-500 italic">
              Note: This analysis controls for observable factors but cannot
              establish causation. Many factors influence digestive outcomes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * ControlledComparison component for displaying side-by-side comparison
 * of Bristol outcomes on high vs low nutrient intake days.
 *
 * Shows:
 * - Nutrient selector dropdown
 * - Two cards comparing average Bristol scores for high and low intake days
 * - Difference indicator with confidence interval
 * - Statistical significance badge
 * - Collapsible methodology explanation
 *
 * @example
 * ```tsx
 * <ControlledComparison
 *   data={comparisonData}
 *   isLoading={isLoading}
 *   error={error}
 *   selectedNutrient="fiber"
 *   onNutrientChange={(key) => setSelectedNutrient(key)}
 * />
 * ```
 */
export function ControlledComparison({
  data,
  isLoading = false,
  error = null,
  onNutrientChange,
  selectedNutrient = "fiber",
}: ControlledComparisonProps) {
  // Loading state
  if (isLoading) {
    return <ComparisonSkeleton />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} />;
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Controlled Comparison Analysis
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Compare Bristol outcomes on high vs low nutrient intake days
        </p>
      </div>

      {/* Nutrient selector */}
      <div className="mb-6">
        <label
          htmlFor="nutrient-select"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Select Nutrient
        </label>
        <select
          id="nutrient-select"
          value={selectedNutrient}
          onChange={(e) => onNutrientChange?.(e.target.value)}
          className="block w-48 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-[#E8A0BF] focus:ring-[#E8A0BF] focus:outline-none"
        >
          {NUTRIENT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* No data state */}
      {!data && (
        <EmptyState message="No comparison data available for the selected nutrient. Try selecting a different nutrient or ensure you have enough data points." />
      )}

      {/* Comparison display */}
      {data && (
        <>
          {/* Nutrient name header */}
          <div className="mb-4 text-center">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Analyzing:{" "}
              <span className="text-gray-900 dark:text-gray-100">
                {data.nutrient_name}
              </span>
            </span>
            <span className="mx-2 text-gray-300 dark:text-gray-600">|</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {data.matched_pairs_count} matched pairs
            </span>
          </div>

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* High intake card */}
            <BristolCard
              title={`Days WITH high ${data.nutrient_name.toLowerCase()}`}
              avgScore={data.avg_bristol_high_intake}
              sampleSize={data.high_intake_count}
            />

            {/* Difference indicator */}
            <div className="flex items-center justify-center py-4">
              <DifferenceIndicator
                difference={data.difference}
                confidenceLow={data.confidence_interval_low}
                confidenceHigh={data.confidence_interval_high}
                highIntakeAvg={data.avg_bristol_high_intake}
                lowIntakeAvg={data.avg_bristol_low_intake}
              />
            </div>

            {/* Low intake card */}
            <BristolCard
              title="Similar days WITHOUT"
              avgScore={data.avg_bristol_low_intake}
              sampleSize={data.low_intake_count}
            />
          </div>

          {/* Significance badge */}
          <div className="flex justify-center mb-4">
            <SignificanceBadge isSignificant={data.is_significant} />
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-4 mt-4 text-xs">
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
        </>
      )}

      {/* Methodology section - always show */}
      <MethodologySection />
    </div>
  );
}
