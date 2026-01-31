"use client";

import { useState, useMemo } from "react";
import { format, subDays, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  useCronometerStatusQuery,
  useSyncCronometerMutation,
  useCorrelationsQuery,
  SyncResponse,
  TimeLag,
  AnalysisLevel,
  MultiLagCorrelationResponse,
  CorrelationResult,
  ConsistentCorrelation,
} from "@/lib/api/cronometer";

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
// Time Lag Options
// =============================================================================

const TIME_LAG_OPTIONS: { value: TimeLag; label: string }[] = [
  { value: 12, label: "12 hours" },
  { value: 24, label: "24 hours" },
  { value: 36, label: "36 hours" },
  { value: 48, label: "48 hours" },
  { value: 72, label: "72 hours" },
];

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
// Main Insights Page
// =============================================================================

export default function InsightsPage() {
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

      {/* Analysis Sections */}
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
    </div>
  );
}
