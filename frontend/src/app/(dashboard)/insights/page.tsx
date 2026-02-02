"use client";

import { useState, useMemo } from "react";
import { format, subDays, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  useCronometerStatusQuery,
  useSyncCronometerMutation,
  useCorrelationsQuery,
  useTimelineQuery,
  useHealthNotesQuery,
  useInterventionsQuery,
  useCreateInterventionMutation,
  useUpdateInterventionMutation,
  useDeleteInterventionMutation,
  useInterventionQuery,
  SyncResponse,
  TimeLag,
  AnalysisLevel,
  MultiLagCorrelationResponse,
  CorrelationResult,
  ConsistentCorrelation,
  Intervention,
  InterventionStatus,
  InterventionWithAnalysis,
  TimelineResponse,
  HealthNote,
} from "@/lib/api/cronometer";
// Chart components - some are used, others are prepared for future use
import {
  ScatterPlot,
  ScatterDataPoint,
  CorrelationHeatmap,
  TimeSeriesChart,
  BoxPlot,
  BoxPlotDataPoint,
  CalendarHeatmap,
  LagCorrelationChart,
} from "@/components/charts";

// =============================================================================
// Tab Types
// =============================================================================

type TabType = "analysis" | "visualizations" | "experiments";
type ChartType = "scatter" | "heatmap" | "timeseries" | "boxplot" | "calendar" | "lagchart";

// =============================================================================
// Nutrient Options for Selector
// =============================================================================

interface NutrientOption {
  value: string;
  label: string;
  category: string;
}

const NUTRIENT_OPTIONS: NutrientOption[] = [
  // Macros
  { value: "calories", label: "Calories", category: "Macros" },
  { value: "protein", label: "Protein", category: "Macros" },
  { value: "carbs", label: "Carbohydrates", category: "Macros" },
  { value: "fat", label: "Total Fat", category: "Macros" },
  { value: "fiber", label: "Fiber", category: "Macros" },
  { value: "sugar", label: "Sugar", category: "Macros" },
  { value: "saturated_fat", label: "Saturated Fat", category: "Macros" },
  { value: "monounsaturated_fat", label: "Monounsaturated Fat", category: "Macros" },
  { value: "polyunsaturated_fat", label: "Polyunsaturated Fat", category: "Macros" },
  { value: "cholesterol", label: "Cholesterol", category: "Macros" },
  { value: "net_carbs", label: "Net Carbs", category: "Macros" },
  // Fatty Acids
  { value: "omega_3", label: "Omega-3", category: "Fatty Acids" },
  { value: "omega_6", label: "Omega-6", category: "Fatty Acids" },
  // Vitamins
  { value: "vitamin_a", label: "Vitamin A", category: "Vitamins" },
  { value: "vitamin_c", label: "Vitamin C", category: "Vitamins" },
  { value: "vitamin_d", label: "Vitamin D", category: "Vitamins" },
  { value: "vitamin_e", label: "Vitamin E", category: "Vitamins" },
  { value: "vitamin_k", label: "Vitamin K", category: "Vitamins" },
  { value: "vitamin_b1", label: "Thiamin (B1)", category: "Vitamins" },
  { value: "vitamin_b2", label: "Riboflavin (B2)", category: "Vitamins" },
  { value: "vitamin_b3", label: "Niacin (B3)", category: "Vitamins" },
  { value: "vitamin_b5", label: "Pantothenic Acid (B5)", category: "Vitamins" },
  { value: "vitamin_b6", label: "Vitamin B6", category: "Vitamins" },
  { value: "vitamin_b9", label: "Folate (B9)", category: "Vitamins" },
  { value: "vitamin_b12", label: "Vitamin B12", category: "Vitamins" },
  // Minerals
  { value: "calcium", label: "Calcium", category: "Minerals" },
  { value: "iron", label: "Iron", category: "Minerals" },
  { value: "magnesium", label: "Magnesium", category: "Minerals" },
  { value: "phosphorus", label: "Phosphorus", category: "Minerals" },
  { value: "potassium", label: "Potassium", category: "Minerals" },
  { value: "sodium", label: "Sodium", category: "Minerals" },
  { value: "zinc", label: "Zinc", category: "Minerals" },
  { value: "copper", label: "Copper", category: "Minerals" },
  { value: "manganese", label: "Manganese", category: "Minerals" },
  { value: "selenium", label: "Selenium", category: "Minerals" },
  // Other
  { value: "water", label: "Water", category: "Other" },
  { value: "caffeine", label: "Caffeine", category: "Other" },
  { value: "alcohol", label: "Alcohol", category: "Other" },
];

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "scatter", label: "Scatter Plot" },
  { value: "heatmap", label: "Correlation Heatmap" },
  { value: "timeseries", label: "Time Series" },
  { value: "boxplot", label: "Box Plot" },
  { value: "calendar", label: "Calendar Heatmap" },
  { value: "lagchart", label: "Lag Correlation" },
];

// Group nutrients by category
const groupedNutrientOptions = NUTRIENT_OPTIONS.reduce((acc, option) => {
  if (!acc[option.category]) {
    acc[option.category] = [];
  }
  acc[option.category].push(option);
  return acc;
}, {} as Record<string, NutrientOption[]>);

// Get unit for a nutrient key
// Units match Cronometer's raw_data format
function getNutrientUnit(nutrientKey: string): string {
  const units: Record<string, string> = {
    // Macros
    calories: "kcal",
    protein: "g",
    carbs: "g",
    fat: "g",
    fiber: "g",
    sugar: "g",
    saturated_fat: "g",
    monounsaturated_fat: "g",
    polyunsaturated_fat: "g",
    cholesterol: "mg",
    net_carbs: "g",
    // Fatty Acids
    omega_3: "g",
    omega_6: "g",
    // Vitamins
    vitamin_a: "μg",
    vitamin_c: "mg",
    vitamin_d: "IU", // Cronometer uses IU for Vitamin D
    vitamin_e: "mg",
    vitamin_k: "μg",
    vitamin_b1: "mg",
    vitamin_b2: "mg",
    vitamin_b3: "mg",
    vitamin_b5: "mg",
    vitamin_b6: "mg",
    vitamin_b9: "μg",
    vitamin_b12: "μg",
    folate: "μg",
    // Minerals
    calcium: "mg",
    iron: "mg",
    magnesium: "mg",
    phosphorus: "mg",
    potassium: "mg",
    sodium: "mg",
    zinc: "mg",
    copper: "mg",
    manganese: "mg",
    selenium: "μg",
    // Other
    water: "g", // Cronometer reports water in grams
    caffeine: "mg",
    alcohol: "g",
  };
  return units[nutrientKey] || "";
}

// Time lag options for scatter plot
const TIME_LAG_OPTIONS: { value: TimeLag; label: string }[] = [
  { value: 12, label: "12 hours" },
  { value: 24, label: "24 hours" },
  { value: 36, label: "36 hours" },
  { value: 48, label: "48 hours" },
  { value: 72, label: "72 hours" },
];

// =============================================================================
// Placeholder Card Component
// =============================================================================

interface PlaceholderCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBgClass?: string;
}

function PlaceholderCard({
  title,
  description,
  icon,
  iconBgClass = "bg-[#F9E4EC] dark:bg-[#E8A0BF]/20",
}: PlaceholderCardProps) {
  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-sm ${iconBgClass}`}
        >
          {icon}
        </div>
        <div>
          <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            {title}
          </h2>
          <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Sync Status Card Component
// =============================================================================

function SyncStatusCard() {
  const { data: status, isLoading } = useCronometerStatusQuery();
  const syncMutation = useSyncCronometerMutation();
  const [daysBack, setDaysBack] = useState(7);
  const [syncSuccess, setSyncSuccess] = useState<SyncResponse | null>(null);

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  const handleSync = async () => {
    setSyncSuccess(null);
    try {
      const result = await syncMutation.mutateAsync({ days_back: daysBack });
      setSyncSuccess(result);
    } catch {
      // Error is handled by mutation state
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#F9E4EC] shadow-sm dark:bg-[#E8A0BF]/20">
            <svg
              className="h-6 w-6 animate-spin text-[#E8A0BF]"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
              Sync Status
            </h2>
            <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
              Loading connection status...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Not connected state
  if (!status?.has_credentials) {
    return (
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] shadow-sm dark:bg-[#FCD34D]/20">
            <svg
              className="h-6 w-6 text-[#F59E0B]"
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
          <div className="flex-1">
            <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
              Sync Status
            </h2>
            <p className="mt-1 text-base text-[#F59E0B]">Not Connected</p>
            <p className="mt-2 text-base text-[#A89B86] dark:text-[#B8A99A]">
              Connect your Cronometer account to sync nutrition data.
            </p>
            <Link
              href="/settings"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#E8A0BF] px-5 py-2.5 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D890AF] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/50 focus:ring-offset-2 dark:hover:bg-[#D890AF]"
            >
              Go to Settings
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Connected state
  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#E8F5E9] shadow-sm dark:bg-[#A8D5BA]/20">
          <svg
            className="h-6 w-6 text-[#A8D5BA]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            Sync Status
          </h2>
          <p className="mt-1 text-base text-[#A8D5BA]">Connected</p>
          <p className="mt-1 text-sm text-[#A89B86] dark:text-[#B8A99A]">
            Last synced: {formatLastSync(status.last_sync_at)}
          </p>

          {/* Sync Controls */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="days-back"
                className="text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]"
              >
                Sync:
              </label>
              <select
                id="days-back"
                value={daysBack}
                onChange={(e) => setDaysBack(Number(e.target.value))}
                className="rounded-xl border border-[#DEDDDB] bg-white px-3 py-2 text-sm text-[#4A4543] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>

            <button
              onClick={handleSync}
              disabled={syncMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E8A0BF] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D890AF] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#D890AF]"
            >
              {syncMutation.isPending ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Sync Now
                </>
              )}
            </button>
          </div>

          {/* Success Message */}
          {syncSuccess && (
            <div className="mt-3 rounded-lg bg-[#E8F5E9] p-3 text-sm text-[#2E7D32] dark:bg-[#A8D5BA]/20 dark:text-[#A8D5BA]">
              <div className="flex items-center gap-2">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>
                  Synced: {syncSuccess.food_logs_synced} food logs,{" "}
                  {syncSuccess.biometric_logs_synced} biometrics,{" "}
                  {syncSuccess.health_notes_synced} notes
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {syncMutation.isError && (
            <div className="mt-3 rounded-lg bg-[#FFEBEE] p-3 text-sm text-[#C62828] dark:bg-[#F5A9A9]/20 dark:text-[#F5A9A9]">
              <div className="flex items-center gap-2">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Failed to sync. Please try again.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Key Insights Card Component
// =============================================================================

interface KeyInsightsCardProps {
  data: MultiLagCorrelationResponse;
}

function KeyInsightsCard({ data }: KeyInsightsCardProps) {
  // Get Bristol score color
  const getBristolColor = (
    score: number
  ): { bg: string; text: string; label: string } => {
    if (score >= 3 && score <= 5) {
      return {
        bg: "bg-[#E8F5E9] dark:bg-[#A8D5BA]/20",
        text: "text-[#2E7D32] dark:text-[#A8D5BA]",
        label: "Healthy",
      };
    } else if (score === 2 || score === 6) {
      return {
        bg: "bg-[#FFF8E1] dark:bg-[#F5D89A]/20",
        text: "text-[#F9A825] dark:text-[#F5D89A]",
        label: "Moderate",
      };
    } else {
      return {
        bg: "bg-[#FFEBEE] dark:bg-[#F5A9A9]/20",
        text: "text-[#C62828] dark:text-[#F5A9A9]",
        label: "Concerning",
      };
    }
  };

  const bristolColor = getBristolColor(data.baseline_bristol_score);

  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
      <div className="flex items-start gap-4">
        {/* Icon - lightbulb */}
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#E8F5E9] shadow-sm dark:bg-[#A8D5BA]/20">
          <svg
            className="h-6 w-6 text-[#A8D5BA]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            Key Insights
          </h2>

          {/* Stats Row */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Baseline Bristol */}
            <div className={`rounded-xl p-4 ${bristolColor.bg}`}>
              <p className={`text-sm font-medium ${bristolColor.text}`}>
                Baseline Bristol
              </p>
              <p className={`font-serif text-2xl font-bold ${bristolColor.text}`}>
                {data.baseline_bristol_score.toFixed(1)}
              </p>
              <p className={`text-xs ${bristolColor.text}`}>
                {bristolColor.label}
              </p>
            </div>

            {/* Food Logs */}
            <div className="rounded-xl bg-[#F9E4EC] p-4 dark:bg-[#E8A0BF]/20">
              <p className="text-sm font-medium text-[#C77998] dark:text-[#E8A0BF]">
                Food Logs
              </p>
              <p className="font-serif text-2xl font-bold text-[#C77998] dark:text-[#E8A0BF]">
                {data.total_food_logs}
              </p>
            </div>

            {/* BM Samples */}
            <div className="rounded-xl bg-[#E8E5EB] p-4 dark:bg-[#6B5B7A]/20">
              <p className="text-sm font-medium text-[#6B5B7A] dark:text-[#B8A99A]">
                BM Samples
              </p>
              <p className="font-serif text-2xl font-bold text-[#6B5B7A] dark:text-[#B8A99A]">
                {data.total_bowel_movements}
              </p>
            </div>
          </div>

          {/* Insights List */}
          {data.insights.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                Analysis Summary
              </h3>
              <ul className="space-y-2">
                {data.insights.map((insight, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-[#4A4543] dark:text-[#F5F3F0]"
                  >
                    <svg
                      className="h-5 w-5 flex-shrink-0 text-[#A8D5BA]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.insights.length === 0 && (
            <p className="mt-4 text-sm text-[#A89B86] dark:text-[#B8A99A]">
              No significant insights found. Try adjusting the date range or
              time lag windows.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Consistent Findings Card Component
// =============================================================================

interface ConsistentFindingsCardProps {
  consistentCorrelations: ConsistentCorrelation[];
}

function ConsistentFindingsCard({
  consistentCorrelations,
}: ConsistentFindingsCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Get direction color and icon
  const getDirectionStyles = (direction: string) => {
    switch (direction) {
      case "positive":
        return {
          bg: "bg-[#E8F5E9] dark:bg-[#A8D5BA]/20",
          text: "text-[#2E7D32] dark:text-[#A8D5BA]",
          icon: "\u2191",
          label: "Higher Bristol with more intake",
        };
      case "negative":
        return {
          bg: "bg-[#FFEBEE] dark:bg-[#F5A9A9]/20",
          text: "text-[#C62828] dark:text-[#F5A9A9]",
          icon: "\u2193",
          label: "Lower Bristol with more intake",
        };
      default:
        return {
          bg: "bg-[#FFF8E1] dark:bg-[#F5D89A]/20",
          text: "text-[#F9A825] dark:text-[#F5D89A]",
          icon: "\u2194",
          label: "Mixed effect",
        };
    }
  };

  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
      <div className="flex items-center gap-2">
        <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Consistent Findings
        </h2>
        {/* Info tooltip */}
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E8E5EB] text-xs text-[#6B5B7A] hover:bg-[#DEDDDB] dark:bg-[#3D3935] dark:text-[#B8A99A]"
          >
            ?
          </button>
          {showTooltip && (
            <div className="absolute left-0 top-full z-10 mt-2 w-64 rounded-lg bg-[#4A4543] p-3 text-xs text-white shadow-lg dark:bg-[#F5F3F0] dark:text-[#4A4543]">
              Nutrients that show significant correlation across 2 or more time
              windows are more reliable predictors of digestive response.
            </div>
          )}
        </div>
      </div>
      <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
        Nutrients with reliable effects across multiple time windows
      </p>

      {consistentCorrelations.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {consistentCorrelations.map((correlation) => {
            const styles = getDirectionStyles(correlation.direction);
            return (
              <div
                key={correlation.nutrient_name}
                className={`rounded-xl p-4 ${styles.bg}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${styles.text}`}>{styles.icon}</span>
                  <span className={`font-medium ${styles.text}`}>
                    {correlation.nutrient_name}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs">
                  <p className={styles.text}>
                    Correlation: {correlation.avg_correlation.toFixed(3)}
                  </p>
                  <p className={styles.text}>
                    {correlation.windows_significant} time windows
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-[#FDFBF7] p-4 text-center dark:bg-[#3D3935]/50">
          <p className="text-sm text-[#A89B86] dark:text-[#B8A99A]">
            No nutrients showed consistent significant correlations across
            multiple time windows.
          </p>
          <p className="mt-1 text-xs text-[#A89B86] dark:text-[#B8A99A]">
            Try analyzing more data or adjusting the time lag windows.
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Table Header Tooltip Component
// =============================================================================

function TableHeaderTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative ml-1 inline-block">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#E8E5EB] text-[10px] text-[#6B5B7A] hover:bg-[#DEDDDB] dark:bg-[#3D3935] dark:text-[#B8A99A]"
      >
        ?
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 rounded-lg bg-[#4A4543] p-2 text-xs text-white shadow-lg dark:bg-[#F5F3F0] dark:text-[#4A4543]">
          {text}
        </div>
      )}
    </span>
  );
}

// =============================================================================
// Bristol Scale Reference Component
// =============================================================================

function BristolScaleReference() {
  const [isExpanded, setIsExpanded] = useState(false);

  const bristolTypes = [
    { type: 1, description: "Separate hard lumps", color: "#C62828", label: "Constipation" },
    { type: 2, description: "Lumpy and sausage-like", color: "#E57373", label: "Mild constipation" },
    { type: 3, description: "Sausage with cracks", color: "#A8D5BA", label: "Normal" },
    { type: 4, description: "Smooth and soft", color: "#4CAF50", label: "Ideal" },
    { type: 5, description: "Soft blobs with clear edges", color: "#A8D5BA", label: "Normal" },
    { type: 6, description: "Fluffy pieces with ragged edges", color: "#FFB74D", label: "Mild diarrhea" },
    { type: 7, description: "Watery, no solid pieces", color: "#FF7043", label: "Diarrhea" },
  ];

  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-6"
      >
        <div className="flex items-center gap-3">
          <svg className="h-6 w-6 text-[#E8A0BF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-serif text-lg font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            Bristol Stool Scale &amp; How to Read Results
          </span>
        </div>
        <svg
          className={`h-5 w-5 text-[#A89B86] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-[#DEDDDB] p-6 dark:border-[#3D3935]">
          {/* Bristol Scale Grid */}
          <div>
            <h3 className="font-medium text-[#4A4543] dark:text-[#F5F3F0]">Bristol Stool Scale</h3>
            <p className="mt-1 text-sm text-[#A89B86] dark:text-[#B8A99A]">
              A medical classification of stool types
            </p>
            <div className="mt-4 grid gap-2">
              {bristolTypes.map((item) => (
                <div
                  key={item.type}
                  className="flex items-center gap-3 rounded-lg p-2"
                  style={{ backgroundColor: `${item.color}15` }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.type}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                      Type {item.type}: {item.description}
                    </span>
                    <span className="ml-2 text-xs text-[#A89B86] dark:text-[#B8A99A]">
                      ({item.label})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Correlation Explanation */}
          <div className="mt-6 border-t border-[#DEDDDB] pt-6 dark:border-[#3D3935]">
            <h3 className="font-medium text-[#4A4543] dark:text-[#F5F3F0]">Understanding Correlations</h3>
            <div className="mt-4 space-y-4">
              <div className="rounded-lg bg-[#E8F5E9] p-4 dark:bg-[#A8D5BA]/20">
                <h4 className="font-medium text-[#2E7D32] dark:text-[#A8D5BA]">Positive Correlation (&uarr;)</h4>
                <p className="mt-1 text-sm text-[#4A4543] dark:text-[#F5F3F0]">
                  When you eat more of this nutrient, your Bristol score tends to be higher (looser stools).
                </p>
              </div>
              <div className="rounded-lg bg-[#FFEBEE] p-4 dark:bg-[#F5A9A9]/20">
                <h4 className="font-medium text-[#C62828] dark:text-[#F5A9A9]">Negative Correlation (&darr;)</h4>
                <p className="mt-1 text-sm text-[#4A4543] dark:text-[#F5F3F0]">
                  When you eat more of this nutrient, your Bristol score tends to be lower (firmer stools).
                </p>
              </div>
            </div>
          </div>

          {/* Statistical Terms */}
          <div className="mt-6 border-t border-[#DEDDDB] pt-6 dark:border-[#3D3935]">
            <h3 className="font-medium text-[#4A4543] dark:text-[#F5F3F0]">Statistical Terms</h3>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-[#FDFBF7] p-4 dark:bg-[#3D3935]/50">
                <h4 className="font-medium text-[#4A4543] dark:text-[#F5F3F0]">Correlation Coefficient</h4>
                <p className="mt-1 text-sm text-[#A89B86] dark:text-[#B8A99A]">
                  A value from -1 to +1 measuring the strength and direction of the relationship.
                  Values closer to &plusmn;1 indicate stronger relationships; values near 0 indicate weak or no relationship.
                </p>
              </div>
              <div className="rounded-lg bg-[#FDFBF7] p-4 dark:bg-[#3D3935]/50">
                <h4 className="font-medium text-[#4A4543] dark:text-[#F5F3F0]">P-Value</h4>
                <p className="mt-1 text-sm text-[#A89B86] dark:text-[#B8A99A]">
                  The probability that this correlation occurred by chance. A p-value below 0.05 (&check;) means the result is statistically significant — there&apos;s less than 5% chance it&apos;s random.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Correlation Results Table Component
// =============================================================================

interface CorrelationResultsTableProps {
  data: MultiLagCorrelationResponse;
}

type SortField =
  | "nutrient_name"
  | "correlation_coefficient"
  | "p_value"
  | "avg_bristol_high_intake"
  | "avg_bristol_low_intake";
type SortDirection = "asc" | "desc";

function CorrelationResultsTable({ data }: CorrelationResultsTableProps) {
  // Get available time lags from the data
  const availableLags = Object.keys(data.results_by_lag)
    .map(Number)
    .sort((a, b) => a - b);

  const [selectedLag, setSelectedLag] = useState<number>(
    availableLags[0] ?? 24
  );
  const [sortField, setSortField] = useState<SortField>("correlation_coefficient");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Get results for selected time lag
  const results: CorrelationResult[] = data.results_by_lag[selectedLag] ?? [];

  // Sort results
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      if (sortField === "nutrient_name") {
        return sortDirection === "asc"
          ? a.nutrient_name.localeCompare(b.nutrient_name)
          : b.nutrient_name.localeCompare(a.nutrient_name);
      }

      let aVal: number;
      let bVal: number;

      // For correlation, sort by absolute value
      if (sortField === "correlation_coefficient") {
        aVal = Math.abs(a.correlation_coefficient);
        bVal = Math.abs(b.correlation_coefficient);
      } else if (sortField === "avg_bristol_high_intake") {
        aVal = a.avg_bristol_high_intake ?? 0;
        bVal = b.avg_bristol_high_intake ?? 0;
      } else if (sortField === "avg_bristol_low_intake") {
        aVal = a.avg_bristol_low_intake ?? 0;
        bVal = b.avg_bristol_low_intake ?? 0;
      } else {
        aVal = a[sortField] ?? 0;
        bVal = b[sortField] ?? 0;
      }

      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [results, sortField, sortDirection]);

  // Handle sort click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Get correlation color
  const getCorrelationColor = (correlation: number): string => {
    if (Math.abs(correlation) < 0.1) return "text-[#A89B86] dark:text-[#B8A99A]"; // gray
    if (correlation > 0) return "text-[#2E7D32] dark:text-[#A8D5BA]"; // green
    return "text-[#C62828] dark:text-[#F5A9A9]"; // red
  };

  // Get trend arrow
  const getTrendArrow = (
    highBristol: number | null,
    lowBristol: number | null
  ): React.ReactNode => {
    if (highBristol === null || lowBristol === null) return null;
    const diff = highBristol - lowBristol;
    if (Math.abs(diff) < 0.1) return null;
    if (diff > 0) {
      return <span className="text-[#2E7D32] dark:text-[#A8D5BA]">↑</span>;
    }
    return <span className="text-[#C62828] dark:text-[#F5A9A9]">↓</span>;
  };

  // Get sort indicator
  const getSortIndicator = (field: SortField): string => {
    if (sortField !== field) return "";
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  if (availableLags.length === 0) {
    return null;
  }

  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
      <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
        Detailed Correlation Results
      </h2>

      {/* Time Lag Tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {availableLags.map((lag) => (
          <button
            key={lag}
            onClick={() => setSelectedLag(lag)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedLag === lag
                ? "bg-[#E8A0BF] text-white"
                : "border border-[#DEDDDB] text-[#4A4543] hover:bg-[#E8E5EB] dark:border-[#3D3935] dark:text-[#F5F3F0] dark:hover:bg-[#3D3935]"
            }`}
          >
            {lag}h
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#DEDDDB] dark:border-[#3D3935]">
              <th
                className="cursor-pointer p-3 text-left text-sm font-medium text-[#A89B86] hover:text-[#4A4543] dark:text-[#B8A99A] dark:hover:text-[#F5F3F0]"
                onClick={() => handleSort("nutrient_name")}
              >
                Nutrient{getSortIndicator("nutrient_name")}
              </th>
              <th
                className="cursor-pointer p-3 text-right text-sm font-medium text-[#A89B86] hover:text-[#4A4543] dark:text-[#B8A99A] dark:hover:text-[#F5F3F0]"
                onClick={() => handleSort("correlation_coefficient")}
              >
                <span className="inline-flex items-center">
                  Correlation{getSortIndicator("correlation_coefficient")}
                  <TableHeaderTooltip text="Pearson coefficient (-1 to +1). Stronger = closer to +/-1." />
                </span>
              </th>
              <th
                className="cursor-pointer p-3 text-right text-sm font-medium text-[#A89B86] hover:text-[#4A4543] dark:text-[#B8A99A] dark:hover:text-[#F5F3F0]"
                onClick={() => handleSort("p_value")}
              >
                <span className="inline-flex items-center">
                  P-Value{getSortIndicator("p_value")}
                  <TableHeaderTooltip text="Values below 0.05 are statistically significant." />
                </span>
              </th>
              <th className="p-3 text-center text-sm font-medium text-[#A89B86] dark:text-[#B8A99A]">
                Significant
              </th>
              <th
                className="cursor-pointer p-3 text-right text-sm font-medium text-[#A89B86] hover:text-[#4A4543] dark:text-[#B8A99A] dark:hover:text-[#F5F3F0]"
                onClick={() => handleSort("avg_bristol_high_intake")}
              >
                High Intake{getSortIndicator("avg_bristol_high_intake")}
              </th>
              <th
                className="cursor-pointer p-3 text-right text-sm font-medium text-[#A89B86] hover:text-[#4A4543] dark:text-[#B8A99A] dark:hover:text-[#F5F3F0]"
                onClick={() => handleSort("avg_bristol_low_intake")}
              >
                Low Intake{getSortIndicator("avg_bristol_low_intake")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((result, index) => (
              <tr
                key={result.nutrient_name}
                className={`border-b border-[#DEDDDB]/50 dark:border-[#3D3935]/50 ${
                  index % 2 === 0
                    ? "bg-transparent"
                    : "bg-[#FDFBF7] dark:bg-[#3D3935]/30"
                }`}
              >
                <td className="p-3 text-sm text-[#4A4543] dark:text-[#F5F3F0]">
                  {result.nutrient_name}
                </td>
                <td
                  className={`p-3 text-right text-sm font-medium ${getCorrelationColor(result.correlation_coefficient)}`}
                >
                  {result.correlation_coefficient.toFixed(3)}
                </td>
                <td className="p-3 text-right text-sm text-[#4A4543] dark:text-[#F5F3F0]">
                  {result.p_value.toFixed(4)}
                </td>
                <td className="p-3 text-center">
                  {result.is_significant ? (
                    <span className="inline-flex items-center rounded-full bg-[#E8F5E9] px-2 py-1 text-xs font-medium text-[#2E7D32] dark:bg-[#A8D5BA]/20 dark:text-[#A8D5BA]">
                      ✓
                    </span>
                  ) : (
                    <span className="text-[#A89B86] dark:text-[#B8A99A]">
                      -
                    </span>
                  )}
                </td>
                <td className="p-3 text-right text-sm text-[#4A4543] dark:text-[#F5F3F0]">
                  {result.avg_bristol_high_intake !== null ? (
                    <>
                      {result.avg_bristol_high_intake.toFixed(1)}{" "}
                      {getTrendArrow(
                        result.avg_bristol_high_intake,
                        result.avg_bristol_low_intake
                      )}
                    </>
                  ) : (
                    <span className="text-[#A89B86] dark:text-[#B8A99A]">-</span>
                  )}
                </td>
                <td className="p-3 text-right text-sm text-[#4A4543] dark:text-[#F5F3F0]">
                  {result.avg_bristol_low_intake !== null ? (
                    result.avg_bristol_low_intake.toFixed(1)
                  ) : (
                    <span className="text-[#A89B86] dark:text-[#B8A99A]">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedResults.length === 0 && (
        <p className="mt-4 text-center text-sm text-[#A89B86] dark:text-[#B8A99A]">
          No correlation results for this time lag.
        </p>
      )}
    </div>
  );
}

// =============================================================================
// Insufficient Data Card Component
// =============================================================================

function InsufficientDataCard() {
  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] shadow-sm dark:bg-[#FCD34D]/20">
          <svg
            className="h-6 w-6 text-[#F59E0B]"
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
        <div>
          <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            Insufficient Data
          </h2>
          <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
            Not enough data to run correlation analysis. Please sync more days
            from Cronometer or log more bowel movements in your check-ins.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-[#A89B86] dark:text-[#B8A99A]">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
              Try expanding your date range
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
              Reduce the minimum sample size
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
              Sync more historical data from Cronometer
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Correlation Analysis Card Component
// =============================================================================

interface CorrelationAnalysisCardProps {
  startDate: string;
  endDate: string;
  timeLags: TimeLag[];
  setTimeLags: (lags: TimeLag[]) => void;
  analysisLevel: AnalysisLevel;
  setAnalysisLevel: (level: AnalysisLevel) => void;
  minSampleSize: number;
  setMinSampleSize: (size: number) => void;
  isCredentialsLoading: boolean;
  hasCredentials: boolean;
  correlationsData: MultiLagCorrelationResponse | undefined;
  isCorrelationsLoading: boolean;
  correlationsError: Error | null;
  onRunAnalysis: () => void;
}

function CorrelationAnalysisCard({
  startDate,
  endDate,
  timeLags,
  setTimeLags,
  analysisLevel,
  setAnalysisLevel,
  minSampleSize,
  setMinSampleSize,
  isCredentialsLoading,
  hasCredentials,
  correlationsData,
  isCorrelationsLoading,
  correlationsError,
  onRunAnalysis,
}: CorrelationAnalysisCardProps) {
  const isDateRangeValid = startDate && endDate && startDate <= endDate;
  const canRunAnalysis =
    !isCredentialsLoading &&
    hasCredentials &&
    isDateRangeValid &&
    timeLags.length > 0;

  const handleTimeLagChange = (lag: TimeLag, checked: boolean) => {
    if (checked) {
      setTimeLags([...timeLags, lag].sort((a, b) => a - b));
    } else {
      setTimeLags(timeLags.filter((t) => t !== lag));
    }
  };

  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#E8E5EB] shadow-sm dark:bg-[#E8E5EB]/20">
          <svg
            className="h-6 w-6 text-[#6B5B7A]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            Correlation Analysis
          </h2>
          <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
            Explore how nutrients affect your digestion
          </p>

          {/* Controls Section */}
          <div className="mt-6 space-y-6">
            {/* Time Lag Checkboxes */}
            <div>
              <label className="mb-3 block text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                Time Lag Windows
              </label>
              <div className="flex flex-wrap gap-4">
                {TIME_LAG_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={timeLags.includes(option.value)}
                      onChange={(e) =>
                        handleTimeLagChange(option.value, e.target.checked)
                      }
                      className="h-4 w-4 rounded border-[#DEDDDB] text-[#E8A0BF] focus:ring-[#E8A0BF] dark:border-[#3D3935]"
                    />
                    <span className="text-sm text-[#4A4543] dark:text-[#F5F3F0]">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Analysis Level and Min Sample Size */}
            <div className="flex flex-wrap gap-6">
              {/* Analysis Level Dropdown */}
              <div className="flex-1 min-w-[200px]">
                <label
                  htmlFor="analysis-level"
                  className="mb-2 block text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]"
                >
                  Analysis Level
                </label>
                <select
                  id="analysis-level"
                  value={analysisLevel}
                  onChange={(e) =>
                    setAnalysisLevel(e.target.value as AnalysisLevel)
                  }
                  className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-2.5 text-sm text-[#4A4543] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
                >
                  <option value="basic">Basic (Macros only)</option>
                  <option value="standard">Standard</option>
                  <option value="comprehensive">
                    Comprehensive (All nutrients)
                  </option>
                </select>
              </div>

              {/* Min Sample Size Input */}
              <div className="w-32">
                <label
                  htmlFor="min-sample-size"
                  className="mb-2 block text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]"
                >
                  Min Samples
                </label>
                <input
                  id="min-sample-size"
                  type="number"
                  min={3}
                  max={20}
                  value={minSampleSize}
                  onChange={(e) => setMinSampleSize(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-2.5 text-sm text-[#4A4543] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
                />
              </div>
            </div>

            {/* Run Analysis Button */}
            <div>
              <button
                onClick={onRunAnalysis}
                disabled={!canRunAnalysis || isCorrelationsLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E8A0BF] px-6 py-3 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D890AF] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#D890AF]"
              >
                {isCorrelationsLoading ? (
                  <>
                    <svg
                      className="h-5 w-5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                      />
                    </svg>
                    Run Analysis
                  </>
                )}
              </button>

              {/* Validation Messages */}
              {!hasCredentials && !isCredentialsLoading && (
                <p className="mt-2 text-sm text-[#F59E0B]">
                  Connect your Cronometer account in Settings to run analysis.
                </p>
              )}
              {timeLags.length === 0 && (
                <p className="mt-2 text-sm text-[#F59E0B]">
                  Select at least one time lag window.
                </p>
              )}
              {!isDateRangeValid && (
                <p className="mt-2 text-sm text-[#F59E0B]">
                  Please select a valid date range.
                </p>
              )}
            </div>

            {/* Error Message */}
            {correlationsError && (
              <div className="rounded-lg bg-[#FFEBEE] p-3 text-sm text-[#C62828] dark:bg-[#F5A9A9]/20 dark:text-[#F5A9A9]">
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Failed to run analysis. Please try again.</span>
                </div>
              </div>
            )}

            {/* Analysis Complete Indicator */}
            {correlationsData && !isCorrelationsLoading && (
              <div className="rounded-lg bg-[#E8F5E9] p-3 dark:bg-[#A8D5BA]/20">
                <div className="flex items-center gap-2 text-sm font-medium text-[#2E7D32] dark:text-[#A8D5BA]">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Analysis complete - see Key Insights below</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Visualizations Tab Component
// =============================================================================

interface VisualizationsTabProps {
  correlationsData: MultiLagCorrelationResponse | undefined;
  isLoading: boolean;
  startDate: string;
  endDate: string;
  timelineData: TimelineResponse | undefined;
  isTimelineLoading: boolean;
  healthNotes: HealthNote[] | undefined;
  isHealthNotesLoading: boolean;
}

function VisualizationsTab({
  correlationsData,
  isLoading,
  startDate,
  endDate,
  timelineData,
  isTimelineLoading,
  healthNotes,
  isHealthNotesLoading,
}: VisualizationsTabProps) {
  const [selectedNutrient, setSelectedNutrient] = useState<string>("fiber");
  const [selectedChartType, setSelectedChartType] = useState<ChartType>("scatter");
  const [selectedTimeLag, setSelectedTimeLag] = useState<TimeLag>(24);

  // Get the nutrient name for display
  const nutrientLabel = useMemo(() => {
    const option = NUTRIENT_OPTIONS.find((o) => o.value === selectedNutrient);
    return option?.label || selectedNutrient;
  }, [selectedNutrient]);

  // Find matching nutrient key in correlations data
  const matchingNutrientKey = useMemo(() => {
    if (!correlationsData?.results_by_lag) return null;

    // Get the first lag's results to find matching keys
    const firstLagResults = Object.values(correlationsData.results_by_lag)[0] || [];

    // Try to find a matching nutrient key
    const normalizedSelected = selectedNutrient.toLowerCase().replace(/[_-]/g, "");

    for (const result of firstLagResults) {
      const normalizedKey = result.nutrient_key.toLowerCase().replace(/[_-]/g, "");
      if (
        normalizedKey.includes(normalizedSelected) ||
        normalizedSelected.includes(normalizedKey) ||
        result.nutrient_name.toLowerCase().includes(selectedNutrient.toLowerCase())
      ) {
        return result.nutrient_key;
      }
    }
    return null;
  }, [correlationsData, selectedNutrient]);

  // Transform timeline data into scatter plot data points
  // For each Bristol event, find the nutrient intake from the preceding time window
  const scatterData = useMemo((): ScatterDataPoint[] => {
    if (!timelineData?.daily_data || timelineData.daily_data.length === 0) {
      return [];
    }

    const lagHours = selectedTimeLag;
    const lagDays = Math.ceil(lagHours / 24); // Round up to days for daily data
    const points: ScatterDataPoint[] = [];

    // Create a map of date -> daily data for quick lookup
    const dataByDate = new Map<string, typeof timelineData.daily_data[0]>();
    for (const day of timelineData.daily_data) {
      dataByDate.set(day.day, day);
    }

    // For each day with Bristol events, look back lagDays to find nutrient intake
    for (const dayData of timelineData.daily_data) {
      if (dayData.bristol_events.length === 0) continue;

      // Get nutrient intake from preceding days based on lag
      const eventDate = new Date(dayData.day);
      let totalNutrient = 0;
      let daysWithData = 0;

      // Look back lagDays to find nutrient intake
      for (let i = 1; i <= lagDays; i++) {
        const lookbackDate = new Date(eventDate);
        lookbackDate.setDate(lookbackDate.getDate() - i);
        const lookbackKey = format(lookbackDate, "yyyy-MM-dd");
        const lookbackData = dataByDate.get(lookbackKey);

        if (lookbackData?.nutrients[selectedNutrient] !== undefined) {
          totalNutrient += lookbackData.nutrients[selectedNutrient];
          daysWithData++;
        }
      }

      // Skip if no preceding nutrient data
      if (daysWithData === 0) continue;

      // Average the nutrient intake over the lag period
      const avgNutrient = totalNutrient / daysWithData;

      // Create a point for each Bristol event on this day
      for (const event of dayData.bristol_events) {
        points.push({
          date: new Date(event.timestamp),
          nutrientValue: avgNutrient,
          bristolScore: event.bristol_score,
          unit: getNutrientUnit(selectedNutrient),
        });
      }
    }

    return points;
  }, [timelineData, selectedNutrient, selectedTimeLag]);

  // Transform scatter data to box plot format
  const boxPlotData = useMemo((): BoxPlotDataPoint[] => {
    return scatterData.map((point) => ({
      nutrientValue: point.nutrientValue,
      bristolScore: point.bristolScore,
    }));
  }, [scatterData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <div className="flex items-center justify-center py-12">
          <svg
            className="h-8 w-8 animate-spin text-[#E8A0BF]"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="ml-3 text-[#4A4543] dark:text-[#F5F3F0]">
            Loading visualization data...
          </span>
        </div>
      </div>
    );
  }

  // No data state
  if (!correlationsData) {
    return (
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] shadow-sm dark:bg-[#FCD34D]/20">
            <svg
              className="h-6 w-6 text-[#F59E0B]"
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
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
              Run Analysis First
            </h2>
            <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
              Run the correlation analysis in the Analysis tab to visualize your data.
              The visualizations will use the correlation results to create charts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render chart based on selection
  const renderChart = () => {
    switch (selectedChartType) {
      case "scatter":
        // Show loading state if timeline is loading
        if (isTimelineLoading) {
          return (
            <div className="flex items-center justify-center py-12">
              <svg
                className="h-8 w-8 animate-spin text-[#E8A0BF]"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="ml-3 text-[#4A4543] dark:text-[#F5F3F0]">
                Loading timeline data...
              </span>
            </div>
          );
        }

        // Show empty state if no scatter data available
        if (scatterData.length === 0) {
          return (
            <div className="flex items-center justify-center py-12 text-center">
              <div>
                <p className="text-[#A89B86] dark:text-[#B8A99A]">
                  No paired data available for {nutrientLabel}.
                </p>
                <p className="text-sm text-[#A89B86]/80 dark:text-[#B8A99A]/80 mt-1">
                  Try selecting a different nutrient or adjusting the date range.
                </p>
              </div>
            </div>
          );
        }

        // Render the actual ScatterPlot with data
        return (
          <div className="rounded-lg bg-white p-4 dark:bg-[#363230]">
            <div className="mb-4 flex items-center gap-4">
              <label className="text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                Time Lag:
              </label>
              <select
                value={selectedTimeLag}
                onChange={(e) => setSelectedTimeLag(Number(e.target.value) as TimeLag)}
                className="rounded-lg border border-[#DEDDDB] bg-white px-3 py-1.5 text-sm text-[#4A4543] dark:border-[#3D3935] dark:bg-[#363230] dark:text-[#F5F3F0]"
              >
                {TIME_LAG_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[#A89B86] dark:text-[#B8A99A]">
                ({scatterData.length} data points)
              </span>
            </div>
            <ScatterPlot
              data={scatterData}
              nutrientName={nutrientLabel}
              timeLagHours={selectedTimeLag}
              onPointClick={(point) => {
                console.log("Clicked point:", point);
              }}
            />
          </div>
        );

      case "heatmap":
        return (
          <div className="rounded-lg bg-white p-4 dark:bg-[#363230]">
            <CorrelationHeatmap
              correlationData={correlationsData.results_by_lag}
              onCellClick={(nutrientKey, lagHours) => {
                console.log(`Clicked ${nutrientKey} at ${lagHours}h lag`);
              }}
            />
          </div>
        );

      case "timeseries":
        // Show loading state if timeline is loading
        if (isTimelineLoading) {
          return (
            <div className="flex items-center justify-center py-12">
              <svg
                className="h-8 w-8 animate-spin text-[#E8A0BF]"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="ml-3 text-[#4A4543] dark:text-[#F5F3F0]">
                Loading timeline data...
              </span>
            </div>
          );
        }

        // Show empty state if no timeline data
        if (!timelineData || !timelineData.daily_data || timelineData.daily_data.length === 0) {
          return (
            <div className="flex items-center justify-center py-12 text-center">
              <div>
                <p className="text-[#A89B86] dark:text-[#B8A99A]">
                  No timeline data available.
                </p>
                <p className="text-sm text-[#A89B86]/80 dark:text-[#B8A99A]/80 mt-1">
                  Sync your Cronometer data and try again.
                </p>
              </div>
            </div>
          );
        }

        // Render the actual TimeSeriesChart with data
        return (
          <div className="rounded-lg bg-white p-4 dark:bg-[#363230]">
            <TimeSeriesChart
              timelineData={timelineData}
              selectedNutrients={[selectedNutrient]}
              showBristolEvents={true}
              onNutrientToggle={(nutrientKey) => {
                console.log("Toggled nutrient:", nutrientKey);
              }}
              height={400}
              showBrush={timelineData.daily_data.length > 14}
            />
          </div>
        );

      case "boxplot":
        // Show loading state if timeline is loading
        if (isTimelineLoading) {
          return (
            <div className="flex items-center justify-center py-12">
              <svg
                className="h-8 w-8 animate-spin text-[#E8A0BF]"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="ml-3 text-[#4A4543] dark:text-[#F5F3F0]">
                Loading data for box plot...
              </span>
            </div>
          );
        }

        // Show empty state if no box plot data available
        if (boxPlotData.length === 0) {
          return (
            <div className="flex items-center justify-center py-12 text-center">
              <div>
                <p className="text-[#A89B86] dark:text-[#B8A99A]">
                  No paired data available for {nutrientLabel}.
                </p>
                <p className="text-sm text-[#A89B86]/80 dark:text-[#B8A99A]/80 mt-1">
                  Try selecting a different nutrient or adjusting the date range.
                </p>
              </div>
            </div>
          );
        }

        // Render the actual BoxPlot with data
        return (
          <div className="rounded-lg bg-white p-4 dark:bg-[#363230]">
            <div className="mb-4 flex items-center gap-4">
              <label className="text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                Time Lag:
              </label>
              <select
                value={selectedTimeLag}
                onChange={(e) => setSelectedTimeLag(Number(e.target.value) as TimeLag)}
                className="rounded-lg border border-[#DEDDDB] bg-white px-3 py-1.5 text-sm text-[#4A4543] dark:border-[#3D3935] dark:bg-[#363230] dark:text-[#F5F3F0]"
              >
                {TIME_LAG_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[#A89B86] dark:text-[#B8A99A]">
                ({boxPlotData.length} data points)
              </span>
            </div>
            <BoxPlot
              data={boxPlotData}
              nutrientName={nutrientLabel}
              timeLagHours={selectedTimeLag}
              unit={getNutrientUnit(selectedNutrient)}
            />
          </div>
        );

      case "calendar":
        // Show loading state if health notes are loading
        if (isHealthNotesLoading) {
          return (
            <div className="flex items-center justify-center py-12">
              <svg
                className="h-8 w-8 animate-spin text-[#E8A0BF]"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="ml-3 text-[#4A4543] dark:text-[#F5F3F0]">
                Loading health notes data...
              </span>
            </div>
          );
        }

        // Filter to only bowel movement entries with bristol_scale
        const bowelMovements = (healthNotes ?? []).filter(
          (note) => note.is_bowel_movement && note.bristol_scale !== null
        );

        // Show empty state if no bowel movement data
        if (bowelMovements.length === 0) {
          return (
            <div className="flex items-center justify-center py-12 text-center">
              <div>
                <p className="text-[#A89B86] dark:text-[#B8A99A]">
                  No bowel movement data available in the selected date range.
                </p>
                <p className="text-sm text-[#A89B86]/80 dark:text-[#B8A99A]/80 mt-1">
                  Sync your Cronometer data and try again.
                </p>
              </div>
            </div>
          );
        }

        // Transform HealthNote to CalendarHeatmap format
        const calendarData = bowelMovements.map((note) => ({
          logged_at: note.logged_at,
          bristol_scale: note.bristol_scale,
          quantity_score: note.quantity_score,
        }));

        // Render the actual CalendarHeatmap with data
        return (
          <div className="rounded-lg bg-white p-4 dark:bg-[#363230]">
            <CalendarHeatmap
              healthNotes={calendarData}
              startDate={startDate}
              endDate={endDate}
              onDayClick={(date, events) => {
                console.log("Clicked day:", date, events);
              }}
            />
          </div>
        );

      case "lagchart":
        if (!matchingNutrientKey) {
          return (
            <div className="flex items-center justify-center py-12 text-[#A89B86] dark:text-[#B8A99A]">
              <p>No data available for {nutrientLabel}. Try selecting a different nutrient.</p>
            </div>
          );
        }
        return (
          <div className="rounded-lg bg-white p-4 dark:bg-[#363230]">
            <LagCorrelationChart
              nutrientKey={matchingNutrientKey}
              nutrientName={nutrientLabel}
              correlationsByLag={correlationsData.results_by_lag}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Card */}
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Visualization Controls
        </h2>
        <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
          Select a nutrient and chart type to explore your data visually.
        </p>

        <div className="mt-6 flex flex-wrap gap-6">
          {/* Nutrient Selector */}
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="nutrient-select"
              className="mb-2 block text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]"
            >
              Nutrient
            </label>
            <select
              id="nutrient-select"
              value={selectedNutrient}
              onChange={(e) => setSelectedNutrient(e.target.value)}
              className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-2.5 text-sm text-[#4A4543] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
            >
              {Object.entries(groupedNutrientOptions).map(([category, nutrients]) => (
                <optgroup key={category} label={category}>
                  {nutrients.map((nutrient) => (
                    <option key={nutrient.value} value={nutrient.value}>
                      {nutrient.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Chart Type Selector */}
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="chart-type-select"
              className="mb-2 block text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]"
            >
              Chart Type
            </label>
            <select
              id="chart-type-select"
              value={selectedChartType}
              onChange={(e) => setSelectedChartType(e.target.value as ChartType)}
              className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-2.5 text-sm text-[#4A4543] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
            >
              {CHART_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chart type descriptions */}
        <div className="mt-4 rounded-lg bg-[#FDFBF7] p-3 dark:bg-[#3D3935]/50">
          <p className="text-xs text-[#A89B86] dark:text-[#B8A99A]">
            {selectedChartType === "scatter" && "Scatter Plot: Shows the relationship between nutrient intake and Bristol scores."}
            {selectedChartType === "heatmap" && "Heatmap: Visualizes correlations across all nutrients and time lags."}
            {selectedChartType === "timeseries" && "Time Series: Shows nutrient intake and Bristol scores over time."}
            {selectedChartType === "boxplot" && "Box Plot: Shows Bristol score distribution across nutrient intake quartiles."}
            {selectedChartType === "calendar" && "Calendar: GitHub-style heatmap of daily Bristol scores."}
            {selectedChartType === "lagchart" && "Lag Chart: Shows how correlation changes across different time lags for a single nutrient."}
          </p>
        </div>
      </div>

      {/* Chart Display Card */}
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          {CHART_TYPE_OPTIONS.find((o) => o.value === selectedChartType)?.label || "Chart"}
          {selectedChartType !== "heatmap" && ` - ${nutrientLabel}`}
        </h2>
        <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
          Date range: {startDate} to {endDate}
        </p>

        <div className="mt-6">
          {renderChart()}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Experiments Tab Component
// =============================================================================

interface ExperimentsTabProps {
  startDate: string;
  endDate: string;
}

function ExperimentsTab({ startDate, endDate }: ExperimentsTabProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInterventionId, setSelectedInterventionId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<InterventionStatus | "all">("all");

  // Form state for creating/editing interventions
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    hypothesis: "",
    nutrient_key: "",
    target_value: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
  });

  // Queries and mutations
  const { data: interventions, isLoading } = useInterventionsQuery(
    statusFilter === "all" ? undefined : statusFilter
  );
  const { data: selectedIntervention, isLoading: isDetailLoading } = useInterventionQuery(
    selectedInterventionId || "",
    !!selectedInterventionId && showDetailModal
  );
  const createMutation = useCreateInterventionMutation();
  const updateMutation = useUpdateInterventionMutation();
  const deleteMutation = useDeleteInterventionMutation();

  // Status badge colors
  const getStatusColor = (status: InterventionStatus) => {
    switch (status) {
      case "planned":
        return "bg-[#FEF3C7] text-[#92400E] dark:bg-[#FCD34D]/20 dark:text-[#FCD34D]";
      case "active":
        return "bg-[#DBEAFE] text-[#1E40AF] dark:bg-[#60A5FA]/20 dark:text-[#60A5FA]";
      case "completed":
        return "bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#A8D5BA]/20 dark:text-[#A8D5BA]";
      case "cancelled":
        return "bg-[#FFEBEE] text-[#C62828] dark:bg-[#F5A9A9]/20 dark:text-[#F5A9A9]";
      default:
        return "bg-[#F5F3F0] text-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0]";
    }
  };

  // Handle form submission
  const handleCreateIntervention = async () => {
    try {
      await createMutation.mutateAsync({
        title: formData.title,
        description: formData.description || null,
        hypothesis: formData.hypothesis || null,
        nutrient_key: formData.nutrient_key || null,
        target_value: formData.target_value ? parseFloat(formData.target_value) : null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        status: "planned",
      });
      setShowCreateModal(false);
      setFormData({
        title: "",
        description: "",
        hypothesis: "",
        nutrient_key: "",
        target_value: "",
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: "",
      });
    } catch {
      // Error handled by mutation state
    }
  };

  // Handle status update
  const handleUpdateStatus = async (id: string, status: InterventionStatus) => {
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          status,
          end_date: status === "completed" || status === "cancelled"
            ? format(new Date(), "yyyy-MM-dd")
            : undefined,
        },
      });
    } catch {
      // Error handled by mutation state
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this experiment?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      if (selectedInterventionId === id) {
        setShowDetailModal(false);
        setSelectedInterventionId(null);
      }
    } catch {
      // Error handled by mutation state
    }
  };

  // View intervention details
  const handleViewDetails = (id: string) => {
    setSelectedInterventionId(id);
    setShowDetailModal(true);
  };

  // Get Bristol color
  const getBristolColor = (score: number | null) => {
    if (score === null) return "text-[#A89B86]";
    if (score >= 3 && score <= 5) return "text-[#2E7D32] dark:text-[#A8D5BA]";
    if (score === 2 || score === 6) return "text-[#F59E0B]";
    return "text-[#C62828] dark:text-[#F5A9A9]";
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
              Dietary Experiments
            </h2>
            <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
              Track dietary changes and measure their impact on your digestion.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E8A0BF] px-6 py-3 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D890AF] hover:shadow-md"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Experiment
          </button>
        </div>

        {/* Status Filter */}
        <div className="mt-4 flex gap-2">
          {(["all", "active", "planned", "completed", "cancelled"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                statusFilter === status
                  ? "bg-[#E8A0BF] text-white"
                  : "border border-[#DEDDDB] text-[#4A4543] hover:bg-[#E8E5EB] dark:border-[#3D3935] dark:text-[#F5F3F0] dark:hover:bg-[#3D3935]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
          <div className="flex items-center justify-center py-12">
            <svg className="h-8 w-8 animate-spin text-[#E8A0BF]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="ml-3 text-[#4A4543] dark:text-[#F5F3F0]">Loading experiments...</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (!interventions || interventions.length === 0) && (
        <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F9E4EC] dark:bg-[#E8A0BF]/20">
              <svg className="h-8 w-8 text-[#E8A0BF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h3 className="mt-4 font-serif text-lg font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
              No experiments yet
            </h3>
            <p className="mt-2 text-center text-[#A89B86] dark:text-[#B8A99A]">
              Start a dietary experiment to track how specific changes affect your digestion.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#E8A0BF] px-6 py-3 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D890AF]"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Experiment
            </button>
          </div>
        </div>
      )}

      {/* Interventions List */}
      {!isLoading && interventions && interventions.length > 0 && (
        <div className="space-y-4">
          {interventions.map((intervention) => (
            <div
              key={intervention.id}
              className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-serif text-lg font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
                      {intervention.title}
                    </h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${getStatusColor(intervention.status)}`}>
                      {intervention.status}
                    </span>
                  </div>
                  {intervention.hypothesis && (
                    <p className="mt-2 text-sm text-[#A89B86] dark:text-[#B8A99A]">
                      <strong>Hypothesis:</strong> {intervention.hypothesis}
                    </p>
                  )}
                  {intervention.description && (
                    <p className="mt-1 text-sm text-[#4A4543] dark:text-[#F5F3F0]">
                      {intervention.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-sm text-[#A89B86] dark:text-[#B8A99A]">
                    <span>Started: {format(new Date(intervention.start_date), "MMM d, yyyy")}</span>
                    {intervention.end_date && (
                      <span>Ended: {format(new Date(intervention.end_date), "MMM d, yyyy")}</span>
                    )}
                    {intervention.nutrient_key && (
                      <span className="rounded-lg bg-[#F5F3F0] px-2 py-1 dark:bg-[#3D3935]">
                        {intervention.nutrient_key}
                        {intervention.target_value && `: ${intervention.target_value}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewDetails(intervention.id)}
                    className="rounded-lg p-2 text-[#A89B86] hover:bg-[#F5F3F0] dark:text-[#B8A99A] dark:hover:bg-[#3D3935]"
                    title="View details"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  {intervention.status === "planned" && (
                    <button
                      onClick={() => handleUpdateStatus(intervention.id, "active")}
                      className="rounded-lg bg-[#DBEAFE] px-3 py-1 text-sm font-medium text-[#1E40AF] hover:bg-[#BFDBFE] dark:bg-[#60A5FA]/20 dark:text-[#60A5FA]"
                    >
                      Start
                    </button>
                  )}
                  {intervention.status === "active" && (
                    <button
                      onClick={() => handleUpdateStatus(intervention.id, "completed")}
                      className="rounded-lg bg-[#E8F5E9] px-3 py-1 text-sm font-medium text-[#2E7D32] hover:bg-[#C8E6C9] dark:bg-[#A8D5BA]/20 dark:text-[#A8D5BA]"
                    >
                      Complete
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(intervention.id)}
                    className="rounded-lg p-2 text-[#C62828] hover:bg-[#FFEBEE] dark:text-[#F5A9A9] dark:hover:bg-[#F5A9A9]/20"
                    title="Delete"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-[#363230]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-experiment-title"
          >
            <h2 id="create-experiment-title" className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
              New Dietary Experiment
            </h2>
            <p className="mt-1 text-sm text-[#A89B86] dark:text-[#B8A99A]">
              Track a dietary change and measure its impact on your digestion.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-2.5 text-sm text-[#4A4543] shadow-sm focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
                  placeholder="e.g., Increase fiber intake to 35g daily"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                  Hypothesis
                </label>
                <textarea
                  value={formData.hypothesis}
                  onChange={(e) => setFormData({ ...formData, hypothesis: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-2.5 text-sm text-[#4A4543] shadow-sm focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
                  placeholder="What do you expect to happen? e.g., 'More fiber will improve Bristol scores'"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-2.5 text-sm text-[#4A4543] shadow-sm focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
                  placeholder="Additional details about your experiment"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                    Nutrient (optional)
                  </label>
                  <select
                    value={formData.nutrient_key}
                    onChange={(e) => setFormData({ ...formData, nutrient_key: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-2.5 text-sm text-[#4A4543] shadow-sm focus:border-[#E8A0BF] focus:outline-none dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
                  >
                    <option value="">Select nutrient</option>
                    {Object.entries(groupedNutrientOptions).map(([category, nutrients]) => (
                      <optgroup key={category} label={category}>
                        {nutrients.map((n) => (
                          <option key={n.value} value={n.value}>{n.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                    Target Value
                  </label>
                  <input
                    type="number"
                    value={formData.target_value}
                    onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-2.5 text-sm text-[#4A4543] shadow-sm focus:border-[#E8A0BF] focus:outline-none dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
                    placeholder="e.g., 35"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-2.5 text-sm text-[#4A4543] shadow-sm focus:border-[#E8A0BF] focus:outline-none dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                    Planned End Date
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-2.5 text-sm text-[#4A4543] shadow-sm focus:border-[#E8A0BF] focus:outline-none dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl border border-[#DEDDDB] px-6 py-2.5 text-sm font-medium text-[#4A4543] hover:bg-[#F5F3F0] dark:border-[#3D3935] dark:text-[#F5F3F0] dark:hover:bg-[#3D3935]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateIntervention}
                disabled={!formData.title || !formData.start_date || createMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E8A0BF] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#D890AF] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Create Experiment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedIntervention && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-[#363230]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-experiment-title"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="detail-experiment-title" className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
                  {selectedIntervention.title}
                </h2>
                <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium capitalize ${getStatusColor(selectedIntervention.status)}`}>
                  {selectedIntervention.status}
                </span>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedInterventionId(null);
                }}
                className="rounded-lg p-2 text-[#A89B86] hover:bg-[#F5F3F0] dark:hover:bg-[#3D3935]"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {selectedIntervention.hypothesis && (
                <div>
                  <h4 className="text-sm font-medium text-[#A89B86] dark:text-[#B8A99A]">Hypothesis</h4>
                  <p className="mt-1 text-sm text-[#4A4543] dark:text-[#F5F3F0]">{selectedIntervention.hypothesis}</p>
                </div>
              )}

              {selectedIntervention.description && (
                <div>
                  <h4 className="text-sm font-medium text-[#A89B86] dark:text-[#B8A99A]">Description</h4>
                  <p className="mt-1 text-sm text-[#4A4543] dark:text-[#F5F3F0]">{selectedIntervention.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-[#A89B86] dark:text-[#B8A99A]">Start Date</h4>
                  <p className="text-[#4A4543] dark:text-[#F5F3F0]">{format(new Date(selectedIntervention.start_date), "MMMM d, yyyy")}</p>
                </div>
                {selectedIntervention.end_date && (
                  <div>
                    <h4 className="font-medium text-[#A89B86] dark:text-[#B8A99A]">End Date</h4>
                    <p className="text-[#4A4543] dark:text-[#F5F3F0]">{format(new Date(selectedIntervention.end_date), "MMMM d, yyyy")}</p>
                  </div>
                )}
              </div>

              {/* Bristol Comparison */}
              {selectedIntervention.status === "completed" && (
                <div className="rounded-xl border border-[#DEDDDB] p-4 dark:border-[#3D3935]">
                  <h4 className="font-medium text-[#4A4543] dark:text-[#F5F3F0]">Bristol Comparison</h4>
                  <p className="mt-1 text-xs text-[#A89B86] dark:text-[#B8A99A]">
                    Comparing Bristol scores before vs during the experiment
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-[#A89B86] dark:text-[#B8A99A]">Before</p>
                      <p className={`mt-1 text-2xl font-bold ${getBristolColor(selectedIntervention.avg_bristol_before)}`}>
                        {selectedIntervention.avg_bristol_before?.toFixed(1) || "-"}
                      </p>
                      <p className="text-xs text-[#A89B86] dark:text-[#B8A99A]">
                        {selectedIntervention.days_before_analyzed} days
                      </p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      {selectedIntervention.bristol_difference !== null && (
                        <>
                          <svg
                            className={`h-6 w-6 ${selectedIntervention.bristol_difference > 0 ? "text-[#2E7D32]" : selectedIntervention.bristol_difference < 0 ? "text-[#C62828]" : "text-[#A89B86]"}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                          <span className={`mt-1 text-sm font-medium ${selectedIntervention.bristol_difference > 0 ? "text-[#2E7D32]" : selectedIntervention.bristol_difference < 0 ? "text-[#C62828]" : "text-[#A89B86]"}`}>
                            {selectedIntervention.bristol_difference > 0 ? "+" : ""}
                            {selectedIntervention.bristol_difference.toFixed(1)}
                          </span>
                        </>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-[#A89B86] dark:text-[#B8A99A]">During</p>
                      <p className={`mt-1 text-2xl font-bold ${getBristolColor(selectedIntervention.avg_bristol_during)}`}>
                        {selectedIntervention.avg_bristol_during?.toFixed(1) || "-"}
                      </p>
                      <p className="text-xs text-[#A89B86] dark:text-[#B8A99A]">
                        {selectedIntervention.days_during_analyzed} days
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedIntervention.outcome_notes && (
                <div>
                  <h4 className="text-sm font-medium text-[#A89B86] dark:text-[#B8A99A]">Outcome Notes</h4>
                  <p className="mt-1 text-sm text-[#4A4543] dark:text-[#F5F3F0]">{selectedIntervention.outcome_notes}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedInterventionId(null);
                }}
                className="rounded-xl border border-[#DEDDDB] px-6 py-2.5 text-sm font-medium text-[#4A4543] hover:bg-[#F5F3F0] dark:border-[#3D3935] dark:text-[#F5F3F0] dark:hover:bg-[#3D3935]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Insights Page
// =============================================================================

export default function InsightsPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("analysis");

  const [startDate, setStartDate] = useState(() =>
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );

  // Correlation analysis controls state
  const [timeLags, setTimeLags] = useState<TimeLag[]>([24, 48]);
  const [analysisLevel, setAnalysisLevel] = useState<AnalysisLevel>("standard");
  const [minSampleSize, setMinSampleSize] = useState(5);
  const [analysisEnabled, setAnalysisEnabled] = useState(false);

  // Queries
  const { data: cronometerStatus, isLoading: isCredentialsLoading } =
    useCronometerStatusQuery();
  const hasCredentials = cronometerStatus?.has_credentials ?? false;

  // Use a separate query key to control when the query runs
  const correlationsQuery = useCorrelationsQuery(
    {
      startDate,
      endDate,
      timeLags,
      minSampleSize,
      analysisLevel,
    },
    analysisEnabled && hasCredentials
  );

  // Timeline data for charts - fetch all common nutrients
  const timelineQuery = useTimelineQuery(
    {
      startDate,
      endDate,
      nutrients: [
        "fiber", "protein", "carbs", "fat", "calories", "sugar",
        "saturated_fat", "sodium", "potassium", "magnesium", "iron",
        "calcium", "vitamin_c", "vitamin_d", "vitamin_b12", "zinc",
        "water", "caffeine", "cholesterol"
      ],
    },
    activeTab === "visualizations" && hasCredentials
  );

  // Health notes data for calendar heatmap
  const healthNotesQuery = useHealthNotesQuery(
    startDate,
    endDate
  );

  // Trigger analysis when button is clicked
  const handleRunAnalysis = () => {
    setAnalysisEnabled(true);
    // Force refetch in case params changed but analysisEnabled was already true
    if (analysisEnabled) {
      correlationsQuery.refetch();
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <h1 className="font-serif text-3xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
        Nutrition Insights
      </h1>

      {/* Date Range Picker */}
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Date Range
        </h2>
        <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
          Select a date range to analyze your nutrition data.
        </p>

        <div className="mt-6 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="start-date"
              className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]"
            >
              From
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="end-date"
              className="mb-2 block text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]"
            >
              To
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-[#DEDDDB] bg-white px-4 py-3 text-base text-[#4A4543] shadow-sm transition-all duration-200 focus:border-[#E8A0BF] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]/20 dark:border-[#3D3935] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
            />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("analysis")}
          className={`rounded-xl px-6 py-3 text-base font-medium transition-all duration-200 ${
            activeTab === "analysis"
              ? "bg-[#E8A0BF] text-white shadow-md"
              : "border border-[#DEDDDB] bg-white text-[#4A4543] hover:bg-[#E8E5EB] dark:border-[#3D3935] dark:bg-[#363230] dark:text-[#F5F3F0] dark:hover:bg-[#3D3935]"
          }`}
        >
          <span className="flex items-center gap-2">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            Analysis
          </span>
        </button>
        <button
          onClick={() => setActiveTab("visualizations")}
          className={`rounded-xl px-6 py-3 text-base font-medium transition-all duration-200 ${
            activeTab === "visualizations"
              ? "bg-[#E8A0BF] text-white shadow-md"
              : "border border-[#DEDDDB] bg-white text-[#4A4543] hover:bg-[#E8E5EB] dark:border-[#3D3935] dark:bg-[#363230] dark:text-[#F5F3F0] dark:hover:bg-[#3D3935]"
          }`}
        >
          <span className="flex items-center gap-2">
            <svg
              className="h-5 w-5"
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
            Visualizations
          </span>
        </button>
        <button
          onClick={() => setActiveTab("experiments")}
          className={`rounded-xl px-6 py-3 text-base font-medium transition-all duration-200 ${
            activeTab === "experiments"
              ? "bg-[#E8A0BF] text-white shadow-md"
              : "border border-[#DEDDDB] bg-white text-[#4A4543] hover:bg-[#E8E5EB] dark:border-[#3D3935] dark:bg-[#363230] dark:text-[#F5F3F0] dark:hover:bg-[#3D3935]"
          }`}
        >
          <span className="flex items-center gap-2">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            Experiments
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "analysis" && (
        <div className="space-y-6">
          {/* Sync Status */}
          <SyncStatusCard />

          {/* Correlation Analysis */}
          <CorrelationAnalysisCard
            startDate={startDate}
            endDate={endDate}
            timeLags={timeLags}
            setTimeLags={setTimeLags}
            analysisLevel={analysisLevel}
            setAnalysisLevel={setAnalysisLevel}
            minSampleSize={minSampleSize}
            setMinSampleSize={setMinSampleSize}
            isCredentialsLoading={isCredentialsLoading}
            hasCredentials={hasCredentials}
            correlationsData={correlationsQuery.data}
            isCorrelationsLoading={correlationsQuery.isFetching}
            correlationsError={correlationsQuery.error}
            onRunAnalysis={handleRunAnalysis}
          />

          {/* Key Insights - show when analysis has run successfully */}
          {correlationsQuery.data && !correlationsQuery.isFetching && (
            <KeyInsightsCard data={correlationsQuery.data} />
          )}

          {/* Consistent Findings - show when analysis has results */}
          {correlationsQuery.data && !correlationsQuery.isFetching && (
            <ConsistentFindingsCard
              consistentCorrelations={correlationsQuery.data.consistent_correlations}
            />
          )}

          {/* Correlation Results Table - show when analysis has results */}
          {correlationsQuery.data &&
            !correlationsQuery.isFetching &&
            Object.keys(correlationsQuery.data.results_by_lag).length > 0 && (
              <CorrelationResultsTable data={correlationsQuery.data} />
            )}

          {/* Insufficient Data - show when there's an insufficient data error */}
          {correlationsQuery.error &&
            !correlationsQuery.isFetching &&
            correlationsQuery.error.message
              ?.toLowerCase()
              .includes("insufficient") && <InsufficientDataCard />}

          {/* Empty state - show when analysis hasn't run yet */}
          {!analysisEnabled && !correlationsQuery.data && (
            <PlaceholderCard
              title="Key Insights"
              description="Run analysis to discover nutrition patterns"
              icon={
                <svg
                  className="h-6 w-6 text-[#A8D5BA]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              }
              iconBgClass="bg-[#E8F5E9] dark:bg-[#A8D5BA]/20"
            />
          )}

          {/* Help Reference - always visible */}
          <BristolScaleReference />
        </div>
      )}

      {activeTab === "visualizations" && (
        <VisualizationsTab
          correlationsData={correlationsQuery.data}
          isLoading={correlationsQuery.isFetching}
          startDate={startDate}
          endDate={endDate}
          timelineData={timelineQuery.data}
          isTimelineLoading={timelineQuery.isFetching}
          healthNotes={healthNotesQuery.data}
          isHealthNotesLoading={healthNotesQuery.isFetching}
        />
      )}

      {activeTab === "experiments" && (
        <ExperimentsTab startDate={startDate} endDate={endDate} />
      )}
    </div>
  );
}
