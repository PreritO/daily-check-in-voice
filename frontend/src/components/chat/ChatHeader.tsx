"use client";

import { useChatStore } from "@/stores/chat-store";

// =============================================================================
// Types
// =============================================================================

export interface ChatHeaderProps {
  /** Optional className for additional styling */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ChatHeader displays the chat title and action buttons.
 * Shows close button, new conversation button, and back button when applicable.
 */
export function ChatHeader({ className }: ChatHeaderProps) {
  const { currentConversationId, closeChat, startNewConversation } =
    useChatStore();

  const title = currentConversationId ? "Nutrition Assistant" : "Nutrition Assistant";

  return (
    <div
      className={`
        flex items-center justify-between
        px-4 py-3 border-b border-[#DEDDDB]
        dark:border-[#3D3935]
        ${className ?? ""}
      `}
    >
      {/* Left side: Back button (when in conversation) or title */}
      <div className="flex items-center gap-2">
        {currentConversationId && (
          <button
            onClick={startNewConversation}
            aria-label="Back to conversations"
            className="flex items-center justify-center h-8 w-8 rounded-full text-[#4A4543] hover:bg-[#F5F3F0] dark:text-[#F5F3F0] dark:hover:bg-[#3D3935] transition-colors"
          >
            <svg
              className="h-5 w-5"
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
          </button>
        )}
        <h2 className="text-[#4A4543] dark:text-[#F5F3F0] font-medium">
          {title}
        </h2>
      </div>

      {/* Right side: Action buttons */}
      <div className="flex items-center gap-1">
        {/* New conversation button */}
        <button
          onClick={startNewConversation}
          aria-label="Start new conversation"
          className="flex items-center justify-center h-8 w-8 rounded-full text-[#4A4543] hover:bg-[#F5F3F0] dark:text-[#F5F3F0] dark:hover:bg-[#3D3935] transition-colors"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>

        {/* Close button */}
        <button
          onClick={closeChat}
          aria-label="Close chat"
          className="flex items-center justify-center h-8 w-8 rounded-full text-[#4A4543] hover:bg-[#F5F3F0] dark:text-[#F5F3F0] dark:hover:bg-[#3D3935] transition-colors"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
