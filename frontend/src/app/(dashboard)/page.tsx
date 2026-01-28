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

function StatCard({
  title,
  value,
  subtitle,
  icon,
  href,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const content = (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
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
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-transform hover:scale-[1.02]">
        {content}
      </Link>
    );
  }

  return content;
}

function NextScheduledCall({ schedules }: { schedules: Schedule[] }) {
  // Find next enabled schedule with next_run_at
  const nextSchedule = schedules
    .filter((s) => s.enabled && s.next_run_at)
    .sort((a, b) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime())[0];

  if (!nextSchedule || !nextSchedule.next_run_at) {
    return (
      <StatCard
        title="Next Scheduled Call"
        value="Not scheduled"
        subtitle="Set up a schedule to get started"
        icon={
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
        href="/schedule"
      />
    );
  }

  const nextRunDate = new Date(nextSchedule.next_run_at);
  const parsed = parseCronExpression(nextSchedule.cron_expression);
  const timeDisplay = parsed ? formatTime(parsed.hour, parsed.minute) : "";

  return (
    <StatCard
      title="Next Scheduled Call"
      value={timeDisplay}
      subtitle={format(nextRunDate, "EEEE, MMM d")}
      icon={
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      }
      href="/schedule"
    />
  );
}

function RecentCallsSummary({ calls }: { calls: Call[] }) {
  const completedCalls = calls.filter((c) => c.status === "completed").length;
  const thisWeekCalls = calls.filter((c) => {
    const callDate = new Date(c.created_at);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return callDate >= oneWeekAgo;
  }).length;

  return (
    <StatCard
      title="Calls This Week"
      value={thisWeekCalls}
      subtitle={`${completedCalls} completed total`}
      icon={
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      }
      href="/calls"
    />
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
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
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
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: calls, isLoading: callsLoading } = useCallsQuery({ limit: 5 });
  const { data: schedules, isLoading: schedulesLoading } = useSchedulesQuery();
  const triggerCallMutation = useTriggerCallMutation();
  const [startCallError, setStartCallError] = useState<string | null>(null);

  const isLoading = callsLoading || schedulesLoading;

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
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h1>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <NextScheduledCall schedules={schedules ?? []} />
        <RecentCallsSummary calls={calls ?? []} />
      </div>

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
