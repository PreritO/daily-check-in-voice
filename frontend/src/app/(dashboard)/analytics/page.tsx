"use client";

import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  useAnalyticsQuery,
  type MoodTrendItem,
  type Sentiment,
} from "@/lib/api/analytics";

// =============================================================================
// Utility Functions
// =============================================================================

function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return "<1m";
  }
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

function getSentimentColor(sentiment: Sentiment): string {
  switch (sentiment) {
    case "positive":
      return "#A8D5BA";
    case "neutral":
      return "#A89B86";
    case "negative":
      return "#F5A9A9";
    case "concerned":
      return "#F5D89A";
  }
}

function getSentimentLabel(sentiment: Sentiment): string {
  return sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
}

// =============================================================================
// Components
// =============================================================================

function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconBgClass = "bg-[#F9E4EC] text-[#E8A0BF] dark:bg-[#E8A0BF]/20",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgClass?: string;
}) {
  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
      <div className="flex items-center gap-5">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-xl shadow-sm ${iconBgClass}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-[#A89B86] dark:text-[#B8A99A]">
            {title}
          </p>
          <p className="font-serif text-3xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-[#A89B86] dark:text-[#B8A99A]">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MoodTrendChart({ data }: { data: MoodTrendItem[] }) {
  // Take the last 10 calls for chronological order
  const chartData = data.slice(-10).map((item) => {
    const parsedDate = new Date(item.call_date);
    const isValidDate = !isNaN(parsedDate.getTime());
    return {
      date: isValidDate ? format(parsedDate, "MMM d") : "Unknown",
      confidence: Math.round(item.confidence * 100),
      sentiment: item.sentiment,
      fullDate: isValidDate ? format(parsedDate, "MMM d, yyyy") : "Unknown date",
    };
  });

  if (chartData.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-base text-[#A89B86] dark:text-[#B8A99A]">
        No mood data available yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: "#A89B86", fontSize: 13 }}
          axisLine={{ stroke: "#DEDDDB" }}
          tickLine={{ stroke: "#DEDDDB" }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#A89B86", fontSize: 13 }}
          axisLine={{ stroke: "#DEDDDB" }}
          tickLine={{ stroke: "#DEDDDB" }}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="rounded-xl border border-[#DEDDDB] bg-white p-4 shadow-lg dark:border-[#3D3935] dark:bg-[#363230]">
                  <p className="text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
                    {data.fullDate}
                  </p>
                  <p className="text-base text-[#A89B86] dark:text-[#B8A99A]">
                    Mood:{" "}
                    <span
                      style={{ color: getSentimentColor(data.sentiment) }}
                      className="font-medium"
                    >
                      {getSentimentLabel(data.sentiment)}
                    </span>
                  </p>
                  <p className="text-base text-[#A89B86] dark:text-[#B8A99A]">
                    Confidence: {data.confidence}%
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Legend
          content={() => (
            <div className="mt-5 flex flex-wrap justify-center gap-5">
              {(["positive", "neutral", "negative", "concerned"] as Sentiment[]).map(
                (sentiment) => (
                  <div key={sentiment} className="flex items-center gap-2">
                    <div
                      className="h-4 w-4 rounded"
                      style={{ backgroundColor: getSentimentColor(sentiment) }}
                    />
                    <span className="text-base text-[#A89B86] dark:text-[#B8A99A]">
                      {getSentimentLabel(sentiment)}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        />
        <Bar dataKey="confidence" radius={[6, 6, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getSentimentColor(entry.sentiment)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LoadingState() {
  return (
    <div className="space-y-8">
      <div className="h-10 w-56 animate-pulse rounded-lg bg-[#E8E5EB] dark:bg-[#3D3935]" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]"
          >
            <div className="flex items-center gap-5">
              <div className="h-14 w-14 rounded-xl bg-[#E8E5EB] dark:bg-[#3D3935]" />
              <div className="space-y-2">
                <div className="h-4 w-28 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
                <div className="h-8 w-20 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="animate-pulse rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <div className="h-7 w-36 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
        <div className="mt-5 h-72 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
        Analytics
      </h1>
      <div className="rounded-2xl border border-[#F5A9A9] bg-[#F5A9A9]/10 p-6 shadow-sm dark:border-[#F5A9A9]/50 dark:bg-[#F5A9A9]/5">
        <div className="flex items-center gap-4">
          <svg
            className="h-6 w-6 text-[#C77070] dark:text-[#F5A9A9]"
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
          <div>
            <p className="font-serif text-lg font-medium text-[#C77070] dark:text-[#F5A9A9]">
              Failed to load analytics
            </p>
            <p className="text-base text-[#C77070] dark:text-[#F5A9A9]">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
        Analytics
      </h1>
      <div className="rounded-2xl border border-[#DEDDDB] bg-white p-16 text-center shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E8E5EB] dark:bg-[#3D3935]">
          <svg
            className="h-10 w-10 text-[#A89B86]"
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
        <h2 className="mt-6 font-serif text-xl font-medium text-[#4A4543] dark:text-[#F5F3F0]">
          No analytics yet
        </h2>
        <p className="mt-2 text-base text-[#A89B86] dark:text-[#B8A99A]">
          Complete your first wellness call to see your analytics!
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function AnalyticsPage() {
  const { data: analytics, isLoading, error } = useAnalyticsQuery();

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return <ErrorState message={message} />;
  }

  if (!analytics || analytics.total_calls === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
        Analytics
      </h1>

      {/* Stats Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Calls"
          value={analytics.total_calls}
          icon={
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
          }
        />

        <StatCard
          title="Average Duration"
          value={formatDuration(analytics.average_call_duration)}
          subtitle="per call"
          icon={
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />

        <StatCard
          title="Current Streak"
          value={`${analytics.streak_days} days`}
          icon={
            <span className="text-3xl" role="img" aria-label="fire">
              {String.fromCodePoint(0x1F525)}
            </span>
          }
          iconBgClass="bg-[#FFF9E6] text-[#F5D89A] dark:bg-[#F5D89A]/20"
        />

        <StatCard
          title="Calls This Week"
          value={analytics.calls_this_week}
          icon={
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          }
          iconBgClass="bg-[#E8F5E9] text-[#A8D5BA] dark:bg-[#A8D5BA]/20"
        />

        <StatCard
          title="Calls This Month"
          value={analytics.calls_this_month}
          icon={
            <svg
              className="h-7 w-7"
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
          }
          iconBgClass="bg-[#E8E5EB] text-[#6B5B7A] dark:bg-[#E8E5EB]/20"
        />
      </div>

      {/* Mood Trend Chart */}
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]">
        <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Mood Trend
        </h2>
        <p className="mt-1 text-base text-[#A89B86] dark:text-[#B8A99A]">
          Your mood across recent wellness calls
        </p>
        <div className="mt-5">
          <MoodTrendChart data={analytics.mood_trend} />
        </div>
      </div>
    </div>
  );
}
