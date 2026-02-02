"use client";

import { useEffect } from "react";
import { useChatStore } from "@/stores/chat-store";
import { ChatButton } from "./ChatButton";

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
      <ChatButton />
    </div>
  );
}
