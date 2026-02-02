"use client";

import { useChatStore } from "@/stores/chat-store";

// =============================================================================
// Types
// =============================================================================

export interface ChatButtonProps {
  /** Optional className for additional styling */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ChatButton is the floating action button that toggles the chat widget.
 * Shows a chat bubble icon when closed and an X icon when open.
 */
export function ChatButton({ className }: ChatButtonProps) {
  const { isOpen, toggleChat } = useChatStore();

  return (
    <button
      onClick={toggleChat}
      aria-label={isOpen ? "Close chat" : "Open chat"}
      aria-expanded={isOpen}
      className={`
        flex h-14 w-14 items-center justify-center
        rounded-full bg-[#E8A0BF] text-white shadow-lg
        transition-all duration-200
        hover:bg-[#D88FAE] hover:shadow-xl hover:scale-105
        active:scale-95
        ${className ?? ""}
      `}
    >
      {isOpen ? (
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      ) : (
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
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      )}
    </button>
  );
}
