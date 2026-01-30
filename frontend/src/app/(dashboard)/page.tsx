"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { useCallsQuery, useTriggerCallMutation, type Call, type CallStatus } from "@/lib/api/calls";
import {
  useSchedulesQuery,
  parseCronExpression,
  formatTime,
  type Schedule,
} from "@/lib/api/schedules";
import { useCurrentUserQuery, useUserMemoriesQuery, type UserMemory, type UserMemoryType } from "@/lib/api/users";
import { useAnalyticsQuery, type Sentiment, type MoodTrendItem } from "@/lib/api/analytics";
import { AlertBanner } from "@/components/AlertBanner";

function getStatusBadgeClasses(status: CallStatus): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "in_progress":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "scheduled":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }
}

function formatStatus(status: CallStatus): string {
  switch (status) {
    case "in_progress":
      return "In Progress";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function getMoodDotClasses(sentiment: Sentiment): string {
  switch (sentiment) {
    case "positive":
      return "bg-green-500";
    case "neutral":
      return "bg-zinc-400";
    case "negative":
      return "bg-red-500";
    case "concerned":
      return "bg-amber-500";
  }
}

function getMemoryTypeBadgeClasses(memoryType: UserMemoryType): string {
  switch (memoryType) {
    case "fact":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "preference":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "event":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "relationship":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  }
}

function formatMemoryType(memoryType: UserMemoryType): string {
  return memoryType.charAt(0).toUpperCase() + memoryType.slice(1);
}

function WelcomeHeader({ userName }: { userName: string | undefined }) {
  const displayName = userName || "there";
  const hour = new Date().getHours();
  let greeting = "Good morning";
  if (hour >= 12 && hour < 17) {
    greeting = "Good afternoon";
  } else if (hour >= 17) {
    greeting = "Good evening";
  }

  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {greeting}, {displayName}!
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Here&apos;s how you&apos;re doing with your daily check-ins.
      </p>
    </div>
  );
}

function QuickStatsRow({
  callsThisWeek,
  streakDays,
}: {
  callsThisWeek: number;
  streakDays: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Calls This Week
            </p>
            <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {callsThisWeek}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
            <span className="text-lg" role="img" aria-label="fire">
              {streakDays > 0 ? String.fromCodePoint(0x1F525) : String.fromCodePoint(0x1F4AA)}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Current Streak
            </p>
            <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {streakDays} {streakDays === 1 ? "day" : "days"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMoodTrend({ moodTrend }: { moodTrend: MoodTrendItem[] }) {
  // Take the last 5 moods
  const lastFiveMoods = moodTrend.slice(-5);

  if (lastFiveMoods.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Mood Trend
        </h2>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Complete calls to see mood trends
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Mood Trend
        </h2>
        <Link
          href="/analytics"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View details
        </Link>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-center gap-3">
          {lastFiveMoods.map((mood, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <div
                className={`h-4 w-4 rounded-full ${getMoodDotClasses(mood.sentiment)}`}
                title={`${mood.sentiment} - ${format(new Date(mood.call_date), "MMM d")}`}
              />
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {format(new Date(mood.call_date), "M/d")}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span>Positive</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-zinc-400" />
            <span>Neutral</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Concerned</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span>Negative</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemoryCard({ memory }: { memory: UserMemory }) {
  const daysAgo = Math.floor(
    (Date.now() - new Date(memory.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const timeAgo =
    daysAgo === 0
      ? "Today"
      : daysAgo === 1
      ? "1 day ago"
      : `${daysAgo} days ago`;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getMemoryTypeBadgeClasses(
            memory.memory_type
          )}`}
        >
          {formatMemoryType(memory.memory_type)}
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{timeAgo}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">
        {memory.content}
      </p>
    </div>
  );
}

function MemoriesSection({ memories }: { memories: UserMemory[] }) {
  if (memories.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Recent Memories
        </h2>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Complete a call to start building memories
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Recent Memories
        </h2>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {memories.length} {memories.length === 1 ? "memory" : "memories"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {memories.slice(0, 3).map((memory) => (
          <MemoryCard key={memory.id} memory={memory} />
        ))}
      </div>
    </div>
  );
}

function NextScheduledCall({ schedules }: { schedules: Schedule[] }) {
  // Find next enabled schedule with next_run_at
  const nextSchedule = schedules
    .filter((s) => s.enabled && s.next_run_at)
    .sort((a, b) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime())[0];

  if (!nextSchedule || !nextSchedule.next_run_at) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Next Scheduled Call
            </p>
            <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Not scheduled
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Set up a schedule to get started
            </p>
          </div>
        </div>
        <Link
          href="/schedule"
          className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Create schedule
          <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    );
  }

  const nextRunDate = new Date(nextSchedule.next_run_at);
  const parsed = parseCronExpression(nextSchedule.cron_expression);
  const timeDisplay = parsed ? formatTime(parsed.hour, parsed.minute) : "";
  const countdown = formatDistanceToNow(nextRunDate, { addSuffix: true });

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Next Scheduled Call
          </p>
          <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {timeDisplay}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {format(nextRunDate, "EEEE, MMM d")} ({countdown})
          </p>
        </div>
      </div>
      <Link
        href="/schedule"
        className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Manage schedule
        <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

function RecentCallItem({ call }: { call: Call }) {
  const date = call.started_at || call.scheduled_at || call.created_at;

  return (
    <Link
      href={`/calls/${call.id}`}
      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClasses(
            call.status
          )}`}
        >
          {formatStatus(call.status)}
        </span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {formatDistanceToNow(new Date(date), { addSuffix: true })}
        </span>
      </div>
      <svg
        className="h-5 w-5 text-zinc-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

function QuickActions({
  onStartCall,
  isStartingCall,
  startCallError,
}: {
  onStartCall: () => void;
  isStartingCall: boolean;
  startCallError: string | null;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Quick Actions
      </h2>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onStartCall}
          disabled={isStartingCall}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isStartingCall ? (
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
              Starting Call...
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Start Call Now
            </>
          )}
        </button>
        <Link
          href="/schedule"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Manage Schedule
        </Link>
      </div>
      {startCallError && (
        <div className="mt-3 text-sm text-red-600 dark:text-red-400">
          {startCallError}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="h-8 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-80 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-5 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-6 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: calls, isLoading: callsLoading } = useCallsQuery({ limit: 5 });
  const { data: schedules, isLoading: schedulesLoading } = useSchedulesQuery();
  const { data: user, isLoading: userLoading } = useCurrentUserQuery();
  const { data: analytics, isLoading: analyticsLoading } = useAnalyticsQuery();
  const { data: memories, isLoading: memoriesLoading } = useUserMemoriesQuery(3);
  const triggerCallMutation = useTriggerCallMutation();
  const [startCallError, setStartCallError] = useState<string | null>(null);

  const isLoading = callsLoading || schedulesLoading || userLoading || analyticsLoading || memoriesLoading;

  // Temporary user ID until auth is implemented
  const TEMP_USER_ID = "00000000-0000-0000-0000-000000000001";

  const handleStartCall = async () => {
    setStartCallError(null);
    try {
      const result = await triggerCallMutation.mutateAsync({
        user_id: TEMP_USER_ID,
      });
      // Navigate to call detail page on success
      router.push(`/calls/${result.call_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start call";
      setStartCallError(message);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  const recentCalls = calls?.slice(0, 3) ?? [];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <WelcomeHeader userName={user?.name} />

      {/* Alert Banner */}
      <AlertBanner />

      {/* Quick Stats Row */}
      <QuickStatsRow
        callsThisWeek={analytics?.calls_this_week ?? 0}
        streakDays={analytics?.streak_days ?? 0}
      />

      {/* Next Scheduled Call + Mini Mood Trend */}
      <div className="grid gap-4 sm:grid-cols-2">
        <NextScheduledCall schedules={schedules ?? []} />
        <MiniMoodTrend moodTrend={analytics?.mood_trend ?? []} />
      </div>

      {/* Memories Section */}
      <MemoriesSection memories={memories ?? []} />

      {/* Quick Actions */}
      <QuickActions
        onStartCall={handleStartCall}
        isStartingCall={triggerCallMutation.isPending}
        startCallError={startCallError}
      />

      {/* Recent Calls */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Recent Calls
          </h2>
          <Link
            href="/calls"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View all
          </Link>
        </div>
        {recentCalls.length > 0 ? (
          <div className="mt-4 space-y-3">
            {recentCalls.map((call) => (
              <RecentCallItem key={call.id} call={call} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No calls yet. Start your first standup call or set up a schedule.
          </p>
        )}
      </div>
    </div>
  );
}
