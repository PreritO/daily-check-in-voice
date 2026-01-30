"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { format, differenceInMinutes } from "date-fns";
import {
  useCallQuery,
  usePostToSlackMutation,
  useAnalyzeMoodMutation,
  useExtractMemoriesMutation,
  type CallWithDetails,
  type CallStatus,
  type Transcript,
  type Summary,
  type MoodAnalysis,
  type SentimentType,
  type Memory,
  type MemoryType,
} from "@/lib/api/calls";

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

function formatDateTime(date: string): string {
  return format(new Date(date), "EEEE, MMMM d, yyyy 'at' h:mm a");
}

function formatDuration(call: CallWithDetails): string {
  if (!call.started_at || !call.ended_at) {
    return "-";
  }
  const start = new Date(call.started_at);
  const end = new Date(call.ended_at);
  const minutes = differenceInMinutes(end, start);
  if (minutes < 1) {
    return "Less than 1 minute";
  }
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function formatTimestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function getSentimentBadgeClasses(sentiment: SentimentType): string {
  switch (sentiment) {
    case "positive":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "neutral":
      return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
    case "negative":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "concerned":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  }
}

function getMemoryTypeBadgeClasses(memoryType: MemoryType): string {
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

function formatMemoryType(memoryType: MemoryType): string {
  return memoryType.charAt(0).toUpperCase() + memoryType.slice(1);
}

function formatSentiment(sentiment: SentimentType): string {
  return sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
}

function MoodSection({
  moodAnalysis,
  callId,
  hasTranscripts,
}: {
  moodAnalysis: MoodAnalysis | null;
  callId: string;
  hasTranscripts: boolean;
}) {
  const analyzeMoodMutation = useAnalyzeMoodMutation();
  const [error, setError] = useState<string | null>(null);

  const handleAnalyzeMood = async () => {
    setError(null);
    try {
      await analyzeMoodMutation.mutateAsync(callId);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Failed to analyze mood";
      setError(errorMessage);
    }
  };

  // If no mood analysis exists, show the analyze button
  if (!moodAnalysis) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Mood Analysis
          </h2>
          <button
            onClick={handleAnalyzeMood}
            disabled={analyzeMoodMutation.isPending || !hasTranscripts}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyzeMoodMutation.isPending ? (
              <span className="inline-flex items-center gap-1.5">
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
                Analyzing...
              </span>
            ) : (
              "Analyze Mood"
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-red-500"
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
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {!hasTranscripts && (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Mood analysis requires a transcript. Complete a call first.
          </p>
        )}
      </div>
    );
  }

  // Display existing mood analysis
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Mood Analysis
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Analyzed {format(new Date(moodAnalysis.analyzed_at), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getSentimentBadgeClasses(
            moodAnalysis.overall_sentiment
          )}`}
        >
          {formatSentiment(moodAnalysis.overall_sentiment)}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {/* Confidence */}
        <div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Confidence
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className="h-2 rounded-full bg-indigo-600"
                style={{ width: `${Math.round(moodAnalysis.confidence * 100)}%` }}
              />
            </div>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {Math.round(moodAnalysis.confidence * 100)}%
            </span>
          </div>
        </div>

        {/* Flags */}
        {moodAnalysis.flags.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Flags
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {moodAnalysis.flags.map((flag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                >
                  <svg
                    className="h-3 w-3"
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
                  {flag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {moodAnalysis.notes && (
          <div>
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Analysis Notes
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {moodAnalysis.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MemoryCard({ memory }: { memory: Memory }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getMemoryTypeBadgeClasses(
              memory.memory_type
            )}`}
          >
            {formatMemoryType(memory.memory_type)}
          </span>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            {memory.content}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Importance: {memory.importance}/10
        </h4>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-2 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-2 rounded-full bg-teal-600"
              style={{ width: `${(memory.importance / 10) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MemoriesSection({
  memories,
  callId,
  hasTranscripts,
}: {
  memories: Memory[];
  callId: string;
  hasTranscripts: boolean;
}) {
  const extractMemoriesMutation = useExtractMemoriesMutation();
  const [error, setError] = useState<string | null>(null);

  const handleExtractMemories = async () => {
    setError(null);
    try {
      await extractMemoriesMutation.mutateAsync(callId);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Failed to extract memories";
      setError(errorMessage);
    }
  };

  // If no memories exist, show the extract button
  if (memories.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Memories
          </h2>
          <button
            onClick={handleExtractMemories}
            disabled={extractMemoriesMutation.isPending || !hasTranscripts}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {extractMemoriesMutation.isPending ? (
              <span className="inline-flex items-center gap-1.5">
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
                Extracting...
              </span>
            ) : (
              "Extract Memories"
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-red-500"
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
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {!hasTranscripts && (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Memory extraction requires a transcript. Complete a call first.
          </p>
        )}
      </div>
    );
  }

  // Display existing memories
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Memories
        </h2>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {memories.length} {memories.length === 1 ? "memory" : "memories"} extracted
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {memories.map((memory) => (
          <MemoryCard key={memory.id} memory={memory} />
        ))}
      </div>
    </div>
  );
}

function CallInfoCard({ call }: { call: CallWithDetails }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Call Details
        </h2>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClasses(
            call.status
          )}`}
        >
          {formatStatus(call.status)}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {call.scheduled_at && (
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Scheduled
            </dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
              {formatDateTime(call.scheduled_at)}
            </dd>
          </div>
        )}
        {call.started_at && (
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Started
            </dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
              {formatDateTime(call.started_at)}
            </dd>
          </div>
        )}
        {call.ended_at && (
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Ended
            </dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
              {formatDateTime(call.ended_at)}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Duration
          </dt>
          <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
            {formatDuration(call)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function TranscriptEntry({ entry }: { entry: Transcript }) {
  const isAgent = entry.speaker === "agent";
  return (
    <div
      className={`flex gap-3 ${isAgent ? "flex-row" : "flex-row-reverse"}`}
    >
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          isAgent
            ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        }`}
      >
        {isAgent ? (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
      </div>
      <div className={`flex-1 ${isAgent ? "" : "text-right"}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {isAgent ? "Agent" : "You"}
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {formatTimestamp(entry.timestamp_ms)}
          </span>
        </div>
        <div
          className={`mt-1 inline-block max-w-[85%] rounded-lg px-4 py-2 ${
            isAgent
              ? "bg-blue-50 text-zinc-900 dark:bg-blue-900/20 dark:text-zinc-100"
              : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          }`}
        >
          <p className="text-sm">{entry.content}</p>
        </div>
      </div>
    </div>
  );
}

function TranscriptSection({ transcripts }: { transcripts: Transcript[] }) {
  if (transcripts.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Transcript
        </h2>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          No transcript available for this call.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Transcript
      </h2>
      <div className="mt-4 space-y-4">
        {transcripts.map((entry) => (
          <TranscriptEntry key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function SummarySection({ summary }: { summary: Summary }) {
  const postToSlackMutation = usePostToSlackMutation();
  const [error, setError] = useState<string | null>(null);

  const handlePostToSlack = async () => {
    setError(null);
    try {
      await postToSlackMutation.mutateAsync(summary.id);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to post to Slack";
      setError(errorMessage);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Summary
        </h2>
        <div className="flex items-center gap-2">
          {summary.posted_to_slack ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" />
              </svg>
              Posted to Slack
            </span>
          ) : (
            <button
              onClick={handlePostToSlack}
              disabled={postToSlackMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {postToSlackMutation.isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Posting...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" />
                  </svg>
                  Post to Slack
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            What was accomplished yesterday
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {summary.yesterday}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Plans for today
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {summary.today}
          </p>
        </div>
        {summary.blockers && (
          <div>
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Blockers
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {summary.blockers}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-6 w-6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-7 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
      {/* Call info skeleton */}
      <div className="animate-pulse rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="mt-1 h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          ))}
        </div>
      </div>
      {/* Transcript skeleton */}
      <div className="animate-pulse rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-6 w-28 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex-1">
                <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="mt-2 h-12 w-3/4 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
      <div className="flex">
        <svg
          className="h-6 w-6 text-red-400"
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
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">
            Failed to load call
          </h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {error.message}
          </p>
          <Link
            href="/calls"
            className="mt-4 inline-flex items-center text-sm font-medium text-red-800 hover:text-red-900 dark:text-red-200 dark:hover:text-red-100"
          >
            <svg
              className="mr-1 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to call history
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CallDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: call, isLoading, error } = useCallQuery(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/calls"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            aria-label="Back to call history"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Call Details
          </h1>
        </div>
        <ErrorState error={error as Error} />
      </div>
    );
  }

  if (!call) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/calls"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          aria-label="Back to call history"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Call Details
        </h1>
      </div>

      <CallInfoCard call={call} />

      {call.summary && <SummarySection summary={call.summary} />}

      <MoodSection
        moodAnalysis={call.mood_analysis}
        callId={call.id}
        hasTranscripts={call.transcripts.length > 0}
      />

      <MemoriesSection
        memories={call.memories}
        callId={call.id}
        hasTranscripts={call.transcripts.length > 0}
      />

      <TranscriptSection transcripts={call.transcripts} />
    </div>
  );
}
