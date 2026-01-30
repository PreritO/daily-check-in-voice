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
      return "bg-[#E8F5E9] text-[#5A8F6B] dark:bg-[#A8D5BA]/20 dark:text-[#A8D5BA]";
    case "neutral":
      return "bg-[#E8E5EB] text-[#6B5B7A] dark:bg-[#E8E5EB]/20 dark:text-[#E8E5EB]";
    case "negative":
      return "bg-[#F5A9A9]/20 text-[#C77070] dark:bg-[#F5A9A9]/10 dark:text-[#F5A9A9]";
    case "concerned":
      return "bg-[#FFF9E6] text-[#B8A060] dark:bg-[#F5D89A]/20 dark:text-[#F5D89A]";
  }
}

function getMemoryTypeBadgeClasses(memoryType: MemoryType): string {
  switch (memoryType) {
    case "fact":
      return "bg-[#F9E4EC] text-[#C07A9D] dark:bg-[#E8A0BF]/20 dark:text-[#E8A0BF]";
    case "preference":
      return "bg-[#E8E5EB] text-[#6B5B7A] dark:bg-[#E8E5EB]/20 dark:text-[#E8E5EB]";
    case "event":
      return "bg-[#FFF9E6] text-[#B8A060] dark:bg-[#F5D89A]/20 dark:text-[#F5D89A]";
    case "relationship":
      return "bg-[#E8F5E9] text-[#5A8F6B] dark:bg-[#A8D5BA]/20 dark:text-[#A8D5BA]";
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
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            Mood Analysis
          </h2>
          <button
            onClick={handleAnalyzeMood}
            disabled={analyzeMoodMutation.isPending || !hasTranscripts}
            className="rounded-xl bg-[#E8A0BF] px-5 py-2.5 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D88FAE] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyzeMoodMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
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
                Analyzing...
              </span>
            ) : (
              "Analyze Mood"
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-5 rounded-xl border border-[#F5A9A9] bg-[#F5A9A9]/10 p-4 dark:border-[#F5A9A9]/50 dark:bg-[#F5A9A9]/5">
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 text-[#C77070] dark:text-[#F5A9A9]"
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
              <p className="text-base text-[#C77070] dark:text-[#F5A9A9]">{error}</p>
            </div>
          </div>
        )}

        {!hasTranscripts && (
          <p className="mt-5 text-base text-[#A89B86] dark:text-[#B8A99A]">
            Mood analysis requires a transcript. Complete a call first.
          </p>
        )}
      </div>
    );
  }

  // Display existing mood analysis
  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            Mood Analysis
          </h2>
          <p className="mt-1 text-sm text-[#A89B86] dark:text-[#B8A99A]">
            Analyzed {format(new Date(moodAnalysis.analyzed_at), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getSentimentBadgeClasses(
            moodAnalysis.overall_sentiment
          )}`}
        >
          {formatSentiment(moodAnalysis.overall_sentiment)}
        </span>
      </div>

      <div className="mt-5 space-y-5">
        {/* Confidence */}
        <div>
          <h3 className="text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
            Confidence
          </h3>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-3 flex-1 rounded-full bg-[#E8E5EB] dark:bg-[#3D3935]">
              <div
                className="h-3 rounded-full bg-[#E8A0BF]"
                style={{ width: `${Math.round(moodAnalysis.confidence * 100)}%` }}
              />
            </div>
            <span className="text-base text-[#A89B86] dark:text-[#B8A99A]">
              {Math.round(moodAnalysis.confidence * 100)}%
            </span>
          </div>
        </div>

        {/* Flags */}
        {moodAnalysis.flags.length > 0 && (
          <div>
            <h3 className="text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
              Flags
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {moodAnalysis.flags.map((flag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-2 rounded-full bg-[#FFF9E6] px-3 py-1 text-sm font-medium text-[#B8A060] dark:bg-[#F5D89A]/20 dark:text-[#F5D89A]"
                >
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
            <h3 className="text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
              Analysis Notes
            </h3>
            <p className="mt-2 text-base text-[#A89B86] dark:text-[#B8A99A]">
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
    <div className="card-hover rounded-xl border border-[#DEDDDB] bg-[#FDFBF7] p-5 shadow-sm dark:border-[#4A4543] dark:bg-[#3D3935]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getMemoryTypeBadgeClasses(
              memory.memory_type
            )}`}
          >
            {formatMemoryType(memory.memory_type)}
          </span>
          <p className="mt-3 text-base text-[#4A4543] dark:text-[#F5F3F0]">
            {memory.content}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <h4 className="text-sm font-medium text-[#A89B86] dark:text-[#B8A99A]">
          Importance: {memory.importance}/10
        </h4>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-[#E8E5EB] dark:bg-[#4A4543]">
            <div
              className="h-2 rounded-full bg-[#A8D5BA]"
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
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
            Memories
          </h2>
          <button
            onClick={handleExtractMemories}
            disabled={extractMemoriesMutation.isPending || !hasTranscripts}
            className="rounded-xl bg-[#A8D5BA] px-5 py-2.5 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#8FC4A3] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {extractMemoriesMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
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
                Extracting...
              </span>
            ) : (
              "Extract Memories"
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-5 rounded-xl border border-[#F5A9A9] bg-[#F5A9A9]/10 p-4 dark:border-[#F5A9A9]/50 dark:bg-[#F5A9A9]/5">
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 text-[#C77070] dark:text-[#F5A9A9]"
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
              <p className="text-base text-[#C77070] dark:text-[#F5A9A9]">{error}</p>
            </div>
          </div>
        )}

        {!hasTranscripts && (
          <p className="mt-5 text-base text-[#A89B86] dark:text-[#B8A99A]">
            Memory extraction requires a transcript. Complete a call first.
          </p>
        )}
      </div>
    );
  }

  // Display existing memories
  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Memories
        </h2>
        <span className="text-base text-[#A89B86] dark:text-[#B8A99A]">
          {memories.length} {memories.length === 1 ? "memory" : "memories"} extracted
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {memories.map((memory) => (
          <MemoryCard key={memory.id} memory={memory} />
        ))}
      </div>
    </div>
  );
}

function CallInfoCard({ call }: { call: CallWithDetails }) {
  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Call Details
        </h2>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getStatusBadgeClasses(
            call.status
          )}`}
        >
          {formatStatus(call.status)}
        </span>
      </div>
      <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {call.scheduled_at && (
          <div>
            <dt className="text-base font-medium text-[#A89B86] dark:text-[#B8A99A]">
              Scheduled
            </dt>
            <dd className="mt-1 text-base text-[#4A4543] dark:text-[#F5F3F0]">
              {formatDateTime(call.scheduled_at)}
            </dd>
          </div>
        )}
        {call.started_at && (
          <div>
            <dt className="text-base font-medium text-[#A89B86] dark:text-[#B8A99A]">
              Started
            </dt>
            <dd className="mt-1 text-base text-[#4A4543] dark:text-[#F5F3F0]">
              {formatDateTime(call.started_at)}
            </dd>
          </div>
        )}
        {call.ended_at && (
          <div>
            <dt className="text-base font-medium text-[#A89B86] dark:text-[#B8A99A]">
              Ended
            </dt>
            <dd className="mt-1 text-base text-[#4A4543] dark:text-[#F5F3F0]">
              {formatDateTime(call.ended_at)}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-base font-medium text-[#A89B86] dark:text-[#B8A99A]">
            Duration
          </dt>
          <dd className="mt-1 text-base text-[#4A4543] dark:text-[#F5F3F0]">
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
      className={`flex gap-4 ${isAgent ? "flex-row" : "flex-row-reverse"}`}
    >
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full shadow-sm ${
          isAgent
            ? "bg-[#F9E4EC] text-[#E8A0BF] dark:bg-[#E8A0BF]/20"
            : "bg-[#E8E5EB] text-[#6B5B7A] dark:bg-[#3D3935] dark:text-[#B8A99A]"
        }`}
      >
        {isAgent ? (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
      </div>
      <div className={`flex-1 ${isAgent ? "" : "text-right"}`}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[#A89B86] dark:text-[#B8A99A]">
            {isAgent ? "Miro" : "You"}
          </span>
          <span className="text-sm text-[#A89B86] dark:text-[#B8A99A]">
            {formatTimestamp(entry.timestamp_ms)}
          </span>
        </div>
        <div
          className={`mt-2 inline-block max-w-[85%] rounded-2xl px-5 py-3 shadow-sm ${
            isAgent
              ? "bg-[#F9E4EC] text-[#4A4543] dark:bg-[#E8A0BF]/10 dark:text-[#F5F3F0]"
              : "bg-[#E8E5EB] text-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0]"
          }`}
        >
          <p className="text-base">{entry.content}</p>
        </div>
      </div>
    </div>
  );
}

function TranscriptSection({ transcripts }: { transcripts: Transcript[] }) {
  if (transcripts.length === 0) {
    return (
      <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
        <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Transcript
        </h2>
        <p className="mt-5 text-base text-[#A89B86] dark:text-[#B8A99A]">
          No transcript available for this call.
        </p>
      </div>
    );
  }

  return (
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
      <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
        Transcript
      </h2>
      <div className="mt-5 space-y-5">
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
    <div className="card-hover rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
          Summary
        </h2>
        <div className="flex items-center gap-3">
          {summary.posted_to_slack ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#E8F5E9] px-3 py-1 text-sm font-medium text-[#5A8F6B] dark:bg-[#A8D5BA]/20 dark:text-[#A8D5BA]">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" />
              </svg>
              Posted to Slack
            </span>
          ) : (
            <button
              onClick={handlePostToSlack}
              disabled={postToSlackMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E8A0BF] px-5 py-2.5 text-base font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#D88FAE] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              {postToSlackMutation.isPending ? (
                <>
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Posting...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
        <div className="mt-5 rounded-xl border border-[#F5A9A9] bg-[#F5A9A9]/10 p-4 dark:border-[#F5A9A9]/50 dark:bg-[#F5A9A9]/5">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-[#C77070] dark:text-[#F5A9A9]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-base text-[#C77070] dark:text-[#F5A9A9]">{error}</p>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-5">
        <div>
          <h3 className="text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
            What was accomplished yesterday
          </h3>
          <p className="mt-2 text-base text-[#A89B86] dark:text-[#B8A99A]">
            {summary.yesterday}
          </p>
        </div>
        <div>
          <h3 className="text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
            Plans for today
          </h3>
          <p className="mt-2 text-base text-[#A89B86] dark:text-[#B8A99A]">
            {summary.today}
          </p>
        </div>
        {summary.blockers && (
          <div>
            <h3 className="text-base font-medium text-[#4A4543] dark:text-[#F5F3F0]">
              Blockers
            </h3>
            <p className="mt-2 text-base text-[#A89B86] dark:text-[#B8A99A]">
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
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="flex items-center gap-5">
        <div className="h-7 w-7 animate-pulse rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
        <div className="h-9 w-56 animate-pulse rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
      </div>
      {/* Call info skeleton */}
      <div className="animate-pulse rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
        <div className="flex items-center justify-between">
          <div className="h-7 w-36 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
          <div className="h-6 w-24 rounded-full bg-[#E8E5EB] dark:bg-[#3D3935]" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-5 w-24 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
              <div className="mt-2 h-5 w-48 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
            </div>
          ))}
        </div>
      </div>
      {/* Transcript skeleton */}
      <div className="animate-pulse rounded-2xl border border-[#DEDDDB] bg-white p-6 shadow-sm dark:border-[#4A4543] dark:bg-[#363230]">
        <div className="h-7 w-32 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
        <div className="mt-5 space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-10 w-10 rounded-full bg-[#E8E5EB] dark:bg-[#3D3935]" />
              <div className="flex-1">
                <div className="h-4 w-20 rounded bg-[#E8E5EB] dark:bg-[#3D3935]" />
                <div className="mt-3 h-14 w-3/4 rounded-2xl bg-[#E8E5EB] dark:bg-[#3D3935]" />
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
    <div className="rounded-2xl border border-[#F5A9A9] bg-[#F5A9A9]/10 p-6 shadow-sm dark:border-[#F5A9A9]/50 dark:bg-[#F5A9A9]/5">
      <div className="flex">
        <svg
          className="h-7 w-7 text-[#C77070] dark:text-[#F5A9A9]"
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
          <h3 className="font-serif text-xl font-medium text-[#C77070] dark:text-[#F5A9A9]">
            Failed to load call
          </h3>
          <p className="mt-2 text-base text-[#C77070] dark:text-[#F5A9A9]">
            {error.message}
          </p>
          <Link
            href="/calls"
            className="mt-5 inline-flex items-center text-base font-medium text-[#C77070] transition-colors duration-200 hover:text-[#B55E5E] dark:text-[#F5A9A9] dark:hover:text-[#F5A9A9]"
          >
            <svg
              className="mr-2 h-5 w-5"
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
      <div className="space-y-8">
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-5">
          <Link
            href="/calls"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#A89B86] transition-all duration-200 hover:bg-[#E8E5EB] hover:text-[#4A4543] dark:text-[#B8A99A] dark:hover:bg-[#3D3935] dark:hover:text-[#F5F3F0]"
            aria-label="Back to call history"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="font-serif text-3xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
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
    <div className="space-y-8">
      <div className="flex items-center gap-5">
        <Link
          href="/calls"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[#A89B86] transition-all duration-200 hover:bg-[#E8E5EB] hover:text-[#4A4543] dark:text-[#B8A99A] dark:hover:bg-[#3D3935] dark:hover:text-[#F5F3F0]"
          aria-label="Back to call history"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="font-serif text-3xl font-semibold text-[#4A4543] dark:text-[#F5F3F0]">
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
