"use client";

import { useState } from "react";
import { format, subDays } from "date-fns";

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
        <PlaceholderCard
          title="Sync Status"
          description="Connect Cronometer to sync your nutrition data"
          icon={
            <svg
              className="h-6 w-6 text-[#E8A0BF]"
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
          }
          iconBgClass="bg-[#F9E4EC] dark:bg-[#E8A0BF]/20"
        />

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
