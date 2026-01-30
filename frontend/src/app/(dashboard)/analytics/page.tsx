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
      return "#22c55e";
    case "neutral":
      return "#71717a";
    case "negative":
      return "#ef4444";
    case "concerned":
      return "#f59e0b";
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
  iconBgClass = "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgClass?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconBgClass}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {title}
          </p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
      <div className="flex h-64 items-center justify-center text-zinc-500 dark:text-zinc-400">
        No mood data available yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: "#71717a", fontSize: 12 }}
          axisLine={{ stroke: "#e4e4e7" }}
          tickLine={{ stroke: "#e4e4e7" }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#71717a", fontSize: 12 }}
          axisLine={{ stroke: "#e4e4e7" }}
          tickLine={{ stroke: "#e4e4e7" }}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {data.fullDate}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Mood:{" "}
                    <span
                      style={{ color: getSentimentColor(data.sentiment) }}
                      className="font-medium"
                    >
                      {getSentimentLabel(data.sentiment)}
                    </span>
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
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
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              {(["positive", "neutral", "negative", "concerned"] as Sentiment[]).map(
                (sentiment) => (
                  <div key={sentiment} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded"
                      style={{ backgroundColor: getSentimentColor(sentiment) }}
                    />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {getSentimentLabel(sentiment)}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        />
        <Bar dataKey="confidence" radius={[4, 4, 0, 0]}>
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
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-6 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="animate-pulse rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-6 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-4 h-64 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Analytics
      </h1>
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-900/20">
        <div className="flex items-center gap-3">
          <svg
            className="h-5 w-5 text-red-600 dark:text-red-400"
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
            <p className="font-medium text-red-800 dark:text-red-200">
              Failed to load analytics
            </p>
            <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Analytics
      </h1>
      <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <svg
            className="h-8 w-8 text-zinc-400"
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
        <h2 className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
          No analytics yet
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Complete your first call to see your analytics!
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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Analytics
      </h1>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Calls"
          value={analytics.total_calls}
          icon={
            <svg
              className="h-6 w-6"
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
              className="h-6 w-6"
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
            <span className="text-2xl" role="img" aria-label="fire">
              🔥
            </span>
          }
          iconBgClass="bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
        />

        <StatCard
          title="Calls This Week"
          value={analytics.calls_this_week}
          icon={
            <svg
              className="h-6 w-6"
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
        />

        <StatCard
          title="Calls This Month"
          value={analytics.calls_this_month}
          icon={
            <svg
              className="h-6 w-6"
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
        />
      </div>

      {/* Mood Trend Chart */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Mood Trend
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your mood across recent check-ins
        </p>
        <div className="mt-4">
          <MoodTrendChart data={analytics.mood_trend} />
        </div>
      </div>
    </div>
  );
}
