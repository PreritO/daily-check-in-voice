"use client";

import { useEffect } from "react";
import { useChatStore } from "@/stores/chat-store";

// =============================================================================
// Types
// =============================================================================

export interface ChatWidgetProps {
  /** Optional className for container positioning override */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ChatWidget is the main container for the nutrition chat feature.
 * It displays a floating button when closed and a chat window when open.
 * Fixed position in bottom-right corner of the viewport.
 */
export function ChatWidget({ className }: ChatWidgetProps) {
  const { isOpen, toggleChat, closeChat } = useChatStore();

  // Close chat on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeChat();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeChat]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${className ?? ""}`}>
      {/* Chat Window - animated open/close */}
      <div
        className={`
          absolute bottom-16 right-0 mb-4
          transition-all duration-300 ease-out origin-bottom-right
          ${
            isOpen
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 pointer-events-none"
          }
        `}
      >
        {/* ChatWindow component will be added in US-020 */}
        <div className="w-[380px] h-[600px] rounded-2xl border border-[#DEDDDB] bg-white shadow-xl dark:border-[#3D3935] dark:bg-[#363230] sm:w-[400px]">
          <div className="flex h-full items-center justify-center text-[#A89B86] dark:text-[#8B7E6F]">
            Chat Window Placeholder
          </div>
        </div>
      </div>

      {/* Chat Button - always visible */}
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
    </div>
  );
}
