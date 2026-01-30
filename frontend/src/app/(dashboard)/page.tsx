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
      return "bg-[#E8F5E9] text-[#5A8F6B] dark:bg-[#A8D5BA]/20 dark:text-[#A8D5BA]";
    case "in_progress":
      return "bg-[#F9E4EC] text-[#C07A9D] dark:bg-[#E8A0BF]/20 dark:text-[#E8A0BF]";
    case "scheduled":
      return "bg-[#FFF9E6] text-[#B8A060] dark:bg-[#F5D89A]/20 dark:text-[#F5D89A]";
    case "failed":
      return "bg-[#F5A9A9]/20 text-[#C77070] dark:bg-[#F5A9A9]/10 dark:text-[#F5A9A9]";
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
      return "bg-[#A8D5BA]";
    case "neutral":
      return "bg-[#A89B86]";
    case "negative":
      return "bg-[#F5A9A9]";
    case "concerned":
      return "bg-[#F5D89A]";
  }
}

function getMemoryTypeBadgeClasses(memoryType: UserMemoryType): string {
  switch (memoryType) {
    case "fact":
      return "bg-[#F9E4EC] text-[#C07A9D] dark:bg-[#E8A0BF]/20 dark:text-[#E8A0BF]";
    case "preference":
      return "bg-[#E8F5E9] text-[#5A8F6B] dark:bg-[#A8D5BA]/20 dark:text-[#A8D5BA]";
    case "event":
      return "bg-[#FFF9E6] text-[#B8A060] dark:bg-[#F5D89A]/20 dark:text-[#F5D89A]";
    case "relationship":
      return "bg-[#E8E5EB] text-[#6B5B7A] dark:bg-[#E8E5EB]/20 dark:text-[#E8E5EB]";
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
    <div className="space-y-2">
      <h1 className="font-serif text-3xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
        {greeting}, {displayName}!
      </h1>
      <p className="text-base text-[#A89B86] dark:text-[#B8A99A]">
        Here&apos;s how you&apos;re doing with your daily wellness check-ins.
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
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-5 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F9E4EC] text-[#E8A0BF] shadow-sm dark:bg-[#E8A0BF]/20">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[#A89B86] dark:text-[#B8A99A]">
              Calls This Week
            </p>
            <p className="font-serif text-2xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
              {callsThisWeek}
            </p>
          </div>
        </div>
      </div>

      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-5 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF9E6] text-[#F5D89A] shadow-sm dark:bg-[#F5D89A]/20">
            <span className="text-xl" role="img" aria-label="fire">
              {streakDays > 0 ? String.fromCodePoint(0x1F525) : String.fromCodePoint(0x1F4AA)}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-[#A89B86] dark:text-[#B8A99A]">
              Current Streak
            </p>
            <p className="font-serif text-2xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
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
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
        <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Mood Trend
        </h2>
        <p className="mt-4 text-base text-[#A89B86] dark:text-[#B8A99A]">
          Complete calls to see mood trends
        </p>
      </div>
    );
  }

  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Mood Trend
        </h2>
        <Link
          href="/analytics"
          className="text-sm font-medium text-[#E8A0BF] transition-colors duration-200 hover:text-[#D88FAE]"
        >
          View details
        </Link>
      </div>
      <div className="mt-5">
        <div className="flex items-center justify-center gap-4">
          {lastFiveMoods.map((mood, index) => (
            <div key={index} className="flex flex-col items-center gap-2">
              <div
                className={`h-5 w-5 rounded-full shadow-sm ${getMoodDotClasses(mood.sentiment)}`}
                title={`${mood.sentiment} - ${format(new Date(mood.call_date), "MMM d")}`}
              />
              <span className="text-xs text-[#A89B86] dark:text-[#B8A99A]">
                {format(new Date(mood.call_date), "M/d")}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center gap-5 text-sm text-[#A89B86] dark:text-[#B8A99A]">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#A8D5BA]" />
            <span>Positive</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#A89B86]" />
            <span>Neutral</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#F5D89A]" />
            <span>Concerned</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#F5A9A9]" />
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
    <div className="card-hover rounded-xl border border-[#DEDDDB] bg-[#FDFBF7] p-4 shadow-sm dark:border-[#4A4543] dark:bg-[#3D3935]">
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getMemoryTypeBadgeClasses(
            memory.memory_type
          )}`}
        >
          {formatMemoryType(memory.memory_type)}
        </span>
        <span className="text-sm text-[#A89B86] dark:text-[#B8A99A]">{timeAgo}</span>
      </div>
      <p className="mt-3 text-base text-[#4A4543] dark:text-[#F5F3F0] line-clamp-2">
        {memory.content}
      </p>
    </div>
  );
}

function MemoriesSection({ memories }: { memories: UserMemory[] }) {
  if (memories.length === 0) {
    return (
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
        <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Recent Memories
        </h2>
        <p className="mt-4 text-base text-[#A89B86] dark:text-[#B8A99A]">
          Complete a call to start building memories
        </p>
      </div>
    );
  }

  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Recent Memories
        </h2>
        <span className="text-sm text-[#A89B86] dark:text-[#B8A99A]">
          {memories.length} {memories.length === 1 ? "memory" : "memories"}
        </span>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#E8F5E9] text-[#A8D5BA] shadow-sm dark:bg-[#A8D5BA]/20">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[#A89B86] dark:text-[#B8A99A]">
              Next Scheduled Call
            </p>
            <p className="font-serif text-2xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
              Not scheduled
            </p>
            <p className="text-sm text-[#A89B86] dark:text-[#B8A99A]">
              Set up a schedule to get started
            </p>
          </div>
        </div>
        <Link
          href="/schedule"
          className="mt-5 inline-flex items-center text-base font-medium text-[#E8A0BF] transition-colors duration-200 hover:text-[#D88FAE]"
        >
          Create schedule
          <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#E8F5E9] text-[#A8D5BA] shadow-sm dark:bg-[#A8D5BA]/20">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-[#A89B86] dark:text-[#B8A99A]">
            Next Scheduled Call
          </p>
          <p className="font-serif text-2xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            {timeDisplay}
          </p>
          <p className="text-sm text-[#A89B86] dark:text-[#B8A99A]">
            {format(nextRunDate, "EEEE, MMM d")} ({countdown})
          </p>
        </div>
      </div>
      <Link
        href="/schedule"
        className="mt-5 inline-flex items-center text-base font-medium text-[#E8A0BF] transition-colors duration-200 hover:text-[#D88FAE]"
      >
        Manage schedule
        <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
      className="card-hover flex items-center justify-between rounded-xl border border-[#DEDDDB] bg-white p-5 shadow-sm transition-all duration-200 hover:border-[#E8A0BF]/50 hover:bg-[#FDFBF7] dark:border-[#4A4543] dark:bg-[#363230] dark:hover:border-[#E8A0BF]/30 dark:hover:bg-[#3D3935]"
    >
      <div className="flex items-center gap-4">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getStatusBadgeClasses(
            call.status
          )}`}
        >
          {formatStatus(call.status)}
        </span>
        <span className="text-base text-[#A89B86] dark:text-[#B8A99A]">
          {formatDistanceToNow(new Date(date), { addSuffix: true })}
        </span>
      </div>
      <svg
        className="h-6 w-6 text-[#A89B86]"
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
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
      <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
        Quick Actions
      </h2>
      <div className="mt-5 flex flex-col gap-4 sm:flex-row">
        <button
          onClick={onStartCall}
          disabled={isStartingCall}
          className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#E8A0BF] px-6 py-3 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D88FAE] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isStartingCall ? (
            <>
              <svg
                className="h-6 w-6 animate-spin"
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
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Start Call Now
            </>
          )}
        </button>
        <Link
          href="/schedule"
          className="inline-flex items-center justify-center gap-3 rounded-xl border border-[#DEDDDB] px-6 py-3 text-base font-medium text-[#4A4543] shadow-sm transition-all duration-200 hover:bg-[#E8E5EB] hover:shadow-md dark:border-[#4A4543] dark:text-[#F5F3F0] dark:hover:bg-[#3D3935]"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Manage Schedule
        </Link>
      </div>
      {startCallError && (
        <div className="mt-4 text-base text-[#F5A9A9]">
          {startCallError}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-10 w-72 animate-pulse rounded-lg bg-[#E8E5EB] dark:bg-[#3D3935]" />
        <div className="h-5 w-96 animate-pulse rounded-lg bg-[#E8E5EB] dark:bg-[#3D3935]" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-[#DEDDDB] bg-white p-5 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#E8E5EB] dark:bg-[#3D3935]" />
              <div className="space-y-2">
                <div className="h-4 w-28 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
                <div className="h-6 w-14 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]"
          >
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-[#E8E5EB] dark:bg-[#3D3935]" />
              <div className="space-y-2">
                <div className="h-4 w-36 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
                <div className="h-7 w-24 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
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
    <div className="space-y-8">
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
      <div className="grid gap-5 sm:grid-cols-2">
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
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            Recent Calls
          </h2>
          <Link
            href="/calls"
            className="text-base font-medium text-[#E8A0BF] transition-colors duration-200 hover:text-[#D88FAE]"
          >
            View all
          </Link>
        </div>
        {recentCalls.length > 0 ? (
          <div className="mt-5 space-y-4">
            {recentCalls.map((call) => (
              <RecentCallItem key={call.id} call={call} />
            ))}
          </div>
        ) : (
          <p className="mt-5 text-base text-[#A89B86] dark:text-[#B8A99A]">
            No calls yet. Start your first wellness call or set up a schedule.
          </p>
        )}
      </div>
    </div>
  );
}
