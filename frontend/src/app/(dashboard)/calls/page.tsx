"use client";

import Link from "next/link";
import { useCallsQuery, type Call, type CallStatus, type CallDirection } from "@/lib/api/calls";
import { formatDistanceToNow, format, differenceInMinutes } from "date-fns";

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

function getDirectionBadgeClasses(direction: CallDirection): string {
  switch (direction) {
    case "inbound":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "outbound":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400";
  }
}

function formatDirection(direction: CallDirection): string {
  return direction.charAt(0).toUpperCase() + direction.slice(1);
}

function formatStatus(status: CallStatus): string {
  switch (status) {
    case "in_progress":
      return "In Progress";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function formatDuration(call: Call): string {
  if (!call.started_at || !call.ended_at) {
    return "-";
  }
  const start = new Date(call.started_at);
  const end = new Date(call.ended_at);
  const minutes = differenceInMinutes(end, start);
  if (minutes < 1) {
    return "<1 min";
  }
  return `${minutes} min`;
}

function formatCallDate(call: Call): string {
  const date = call.started_at || call.scheduled_at || call.created_at;
  const dateObj = new Date(date);
  return format(dateObj, "MMM d, yyyy 'at' h:mm a");
}

function formatRelativeTime(call: Call): string {
  const date = call.started_at || call.scheduled_at || call.created_at;
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

function CallListItem({ call }: { call: Call }) {
  return (
    <Link
      href={`/calls/${call.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClasses(
                call.status
              )}`}
            >
              {formatStatus(call.status)}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getDirectionBadgeClasses(
                call.direction
              )}`}
            >
              {formatDirection(call.direction)}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {formatRelativeTime(call)}
            </span>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {formatCallDate(call)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {formatDuration(call)}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">duration</p>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 py-12 dark:border-zinc-700">
      <svg
        className="h-12 w-12 text-zinc-400 dark:text-zinc-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
        />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
        No calls yet
      </h3>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Your call history will appear here once you have your first standup.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
              <div className="h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <div className="text-right">
              <div className="h-5 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="mt-1 h-3 w-14 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <div className="flex">
        <svg
          className="h-5 w-5 text-red-400"
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
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            Failed to load calls
          </h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {error.message}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CallHistoryPage() {
  const { data: calls, isLoading, error } = useCallsQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Call History
        </h1>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error as Error} />
      ) : calls && calls.length > 0 ? (
        <div className="space-y-4">
          {calls.map((call) => (
            <CallListItem key={call.id} call={call} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
