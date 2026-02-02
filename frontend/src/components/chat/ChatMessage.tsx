"use client";

import { useState } from "react";
import type { MessageRole } from "@/lib/api/chat";

// =============================================================================
// Types
// =============================================================================

export interface ChatMessageProps {
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
  /** Message timestamp (ISO string) */
  timestamp?: string;
  /** Whether this is a streaming message */
  isStreaming?: boolean;
  /** Optional className for additional styling */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ChatMessage renders a single chat message bubble.
 * Supports user and assistant roles with different styling.
 * Shows timestamp on hover and typing indicator for streaming.
 */
export function ChatMessage({
  role,
  content,
  timestamp,
  isStreaming,
  className,
}: ChatMessageProps) {
  const [showTimestamp, setShowTimestamp] = useState(false);
  const isUser = role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} ${className ?? ""}`}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      <div
        className={`
          max-w-[80%] px-4 py-2 rounded-2xl
          ${
            isUser
              ? "bg-[#E8A0BF] text-white rounded-br-md"
              : "bg-[#F5F3F0] text-[#4A4543] dark:bg-[#3D3935] dark:text-[#F5F3F0] rounded-bl-md"
          }
        `}
      >
        {/* Message content - renders as markdown for assistant */}
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
            <MarkdownContent content={content} />
          </div>
        )}

        {/* Streaming typing indicator */}
        {isStreaming && (
          <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse rounded-sm" />
        )}

        {/* Timestamp - shown on hover */}
        {timestamp && !isStreaming && showTimestamp && (
          <p
            className={`text-xs mt-1 ${isUser ? "text-white/70" : "text-[#A89B86] dark:text-[#8B7E6F]"}`}
          >
            {new Date(timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Helper Component
// =============================================================================

/**
 * Simple markdown renderer for assistant messages.
 * Supports basic formatting: bold, italic, code, links, lists.
 */
function MarkdownContent({ content }: { content: string }) {
  // Simple markdown-like rendering
  // For a production app, use react-markdown or similar
  const lines = content.split("\n");

  return (
    <>
      {lines.map((line, index) => {
        // Handle bullet points
        if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
          return (
            <li key={index} className="ml-4 list-disc">
              <InlineFormatting text={line.slice(2).trim()} />
            </li>
          );
        }
        // Handle numbered lists
        if (/^\d+\.\s/.test(line.trim())) {
          return (
            <li key={index} className="ml-4 list-decimal">
              <InlineFormatting text={line.replace(/^\d+\.\s/, "").trim()} />
            </li>
          );
        }
        // Handle empty lines
        if (line.trim() === "") {
          return <br key={index} />;
        }
        // Regular paragraph
        return (
          <p key={index} className="mb-1 last:mb-0">
            <InlineFormatting text={line} />
          </p>
        );
      })}
    </>
  );
}

/**
 * Handles inline markdown formatting: **bold**, *italic*, `code`
 */
function InlineFormatting({ text }: { text: string }) {
  // Split by markdown patterns while preserving them
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

  return (
    <>
      {parts.map((part, index) => {
        // Bold
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={index} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        // Italic
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={index}>{part.slice(1, -1)}</em>;
        }
        // Inline code
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={index}
              className="px-1 py-0.5 bg-[#E5E2DD] dark:bg-[#2A2725] rounded text-xs font-mono"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        // Plain text
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}
