"use client";

import { useEffect } from "react";
import { useChatStore } from "@/stores/chat-store";
import { ChatButton } from "./ChatButton";
import { ChatWindow } from "./ChatWindow";

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
  const { isOpen, closeChat } = useChatStore();

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
      {/* On mobile: full screen fixed. On desktop: positioned above button */}
      <div
        className={`
          fixed inset-0 sm:absolute sm:inset-auto sm:bottom-16 sm:right-0 sm:mb-4
          transition-all duration-300 ease-out origin-bottom-right
          ${
            isOpen
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 pointer-events-none"
          }
        `}
      >
        <ChatWindow />
      </div>

      {/* Chat Button - always visible */}
      <ChatButton />
    </div>
  );
}
