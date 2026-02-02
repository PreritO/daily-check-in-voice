"use client";

import { useChatStreaming } from "@/lib/api/streaming";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";

// =============================================================================
// Types
// =============================================================================

export interface ChatWindowProps {
  /** Optional className for additional styling */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ChatWindow is the main chat window container.
 * Contains the header, messages list, and input field.
 * Responsive: fixed size on desktop, full screen on mobile.
 */
export function ChatWindow({ className }: ChatWindowProps) {
  const { sendMessage, isLoading } = useChatStreaming({
    onError: (error) => {
      // TODO: Show error toast or inline message
      console.error("Chat error:", error);
    },
  });

  return (
    <div
      className={`
        flex flex-col
        w-full h-full
        sm:w-[400px] sm:h-[600px]
        rounded-2xl border border-[#DEDDDB] bg-white shadow-xl
        dark:border-[#3D3935] dark:bg-[#363230]
        ${className ?? ""}
      `}
    >
      {/* ChatHeader */}
      <ChatHeader className="flex-shrink-0" />

      {/* ChatMessages */}
      <ChatMessages
        className="flex-1"
        isLoading={isLoading}
        onSuggestionClick={sendMessage}
      />

      {/* ChatInput */}
      <ChatInput className="flex-shrink-0" onSendMessage={sendMessage} />
    </div>
  );
}
