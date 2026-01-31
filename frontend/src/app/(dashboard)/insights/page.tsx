"use client";

import { useState } from "react";
import { format, subDays, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  useCronometerStatusQuery,
  useSyncCronometerMutation,
  SyncResponse,
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
// Main Insights Page
// =============================================================================

export default function InsightsPage() {
  const [startDate, setStartDate] = useState(() =>
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );

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

      {/* Placeholder Sections */}
      <div className="space-y-6">
        {/* Sync Status */}
        <SyncStatusCard />

        {/* Key Insights */}
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

        {/* Correlation Analysis */}
        <PlaceholderCard
          title="Correlation Analysis"
          description="Explore how nutrients affect your digestion"
          icon={
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
          }
          iconBgClass="bg-[#E8E5EB] dark:bg-[#E8E5EB]/20"
        />
      </div>
    </div>
  );
}
