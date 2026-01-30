"use client";

import Link from "next/link";
import { useCallsQuery, type Call, type CallStatus, type CallDirection } from "@/lib/api/calls";
import { formatDistanceToNow, format, differenceInMinutes } from "date-fns";

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

function getDirectionBadgeClasses(direction: CallDirection): string {
  switch (direction) {
    case "inbound":
      return "bg-[#E8E5EB] text-[#6B5B7A] dark:bg-[#E8E5EB]/20 dark:text-[#E8E5EB]";
    case "outbound":
      return "bg-[#F9E4EC] text-[#C07A9D] dark:bg-[#F9E4EC]/20 dark:text-[#F9E4EC]";
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
      className="card-hover block rounded-2xl border border-[#DEDDDB] bg-white p-5 shadow-sm transition-all duration-200 hover:border-[#E8A0BF]/50 hover:bg-[#FDFBF7] dark:border-[#3D3935] dark:bg-[#363230] dark:hover:border-[#E8A0BF]/30 dark:hover:bg-[#3D3935]"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getStatusBadgeClasses(
                call.status
              )}`}
            >
              {formatStatus(call.status)}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getDirectionBadgeClasses(
                call.direction
              )}`}
            >
              {formatDirection(call.direction)}
            </span>
            <span className="text-base text-[#A89B86] dark:text-[#B8A99A]">
              {formatRelativeTime(call)}
            </span>
          </div>
          <p className="text-base text-[#4A4543] dark:text-[#F5F3F0]">
            {formatCallDate(call)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-serif text-lg font-medium text-[#4A4543] dark:text-[#F5F3F0]">
            {formatDuration(call)}
          </p>
          <p className="text-sm text-[#A89B86] dark:text-[#B8A99A]">duration</p>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DEDDDB] py-16 dark:border-[#3D3935]">
      <svg
        className="h-14 w-14 text-[#A89B86] dark:text-[#B8A99A]"
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
      <h3 className="mt-5 font-serif text-xl font-medium text-[#4A4543] dark:text-[#F5F3F0]">
        No calls yet
      </h3>
      <p className="mt-2 text-base text-[#A89B86] dark:text-[#B8A99A]">
        Your call history will appear here once you have your first wellness call.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-[#DEDDDB] bg-white p-5 shadow-sm dark:border-[#3D3935] dark:bg-[#363230]"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="h-6 w-24 rounded-full bg-[#E8E5EB] dark:bg-[#3D3935]" />
                <div className="h-5 w-28 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
              </div>
              <div className="h-5 w-48 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
            </div>
            <div className="text-right">
              <div className="h-6 w-16 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
              <div className="mt-2 h-4 w-16 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="rounded-2xl border border-[#F5A9A9] bg-[#F5A9A9]/10 p-6 shadow-sm dark:border-[#F5A9A9]/50 dark:bg-[#F5A9A9]/5">
      <div className="flex">
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
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="ml-4">
          <h3 className="font-serif text-lg font-medium text-[#C77070] dark:text-[#F5A9A9]">
            Failed to load calls
          </h3>
          <p className="mt-1 text-base text-[#C77070] dark:text-[#F5A9A9]">
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Call History
        </h1>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error as Error} />
      ) : calls && calls.length > 0 ? (
        <div className="space-y-5">
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
