"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import { ChatMessage } from "./ChatMessage";

// =============================================================================
// Types
// =============================================================================

export interface ChatMessagesProps {
  /** Optional className for additional styling */
  className?: string;
  /** Whether messages are loading */
  isLoading?: boolean;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ChatMessages displays the scrollable list of chat messages.
 * Auto-scrolls to bottom when new messages arrive.
 * Shows suggestions for empty conversations.
 */
export function ChatMessages({ className, isLoading }: ChatMessagesProps) {
  const { messages, isStreaming, streamingContent } = useChatStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Show loading spinner
  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center h-full ${className ?? ""}`}
      >
        <div className="flex flex-col items-center gap-2 text-[#A89B86] dark:text-[#8B7E6F]">
          <svg
            className="animate-spin h-6 w-6"
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
          <span className="text-sm">Loading messages...</span>
        </div>
      </div>
    );
  }

  // Show suggestions for empty conversations
  if (messages.length === 0 && !isStreaming) {
    return (
      <div className={`flex flex-col h-full p-4 ${className ?? ""}`}>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-[#4A4543] dark:text-[#F5F3F0] font-medium mb-2">
            Welcome to Nutrition Assistant
          </div>
          <p className="text-sm text-[#A89B86] dark:text-[#8B7E6F] mb-6 max-w-xs">
            Ask me anything about your nutrition data, food logs, or health
            patterns.
          </p>
        </div>
        {/* ChatSuggestions will be added in US-025 */}
        <div className="flex-shrink-0">
          <div className="text-xs text-[#A89B86] dark:text-[#8B7E6F] text-center mb-2">
            Try asking:
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <SuggestionChip text="What did I eat yesterday?" />
            <SuggestionChip text="What are my trigger foods?" />
            <SuggestionChip text="How's my fiber intake?" />
            <SuggestionChip text="Compare good vs bad days" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className={`flex-1 overflow-y-auto p-4 space-y-4 ${className ?? ""}`}
    >
      {/* Message list */}
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          role={message.role}
          content={message.content}
          timestamp={message.created_at}
        />
      ))}

      {/* Streaming message indicator */}
      {isStreaming && streamingContent && (
        <ChatMessage role="assistant" content={streamingContent} isStreaming />
      )}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
}

// =============================================================================
// Helper Component (will be extracted to ChatSuggestions.tsx in US-025)
// =============================================================================

interface SuggestionChipProps {
  text: string;
}

function SuggestionChip({ text }: SuggestionChipProps) {
  const { addMessage } = useChatStore();

  const handleClick = () => {
    // For now, just add the message (actual sending will be handled by ChatInput integration)
    addMessage({
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    });
  };

  return (
    <button
      onClick={handleClick}
      className="px-3 py-2 text-left rounded-lg border border-[#DEDDDB] bg-white text-[#4A4543] hover:bg-[#F5F3F0] hover:border-[#E8A0BF] transition-colors dark:border-[#3D3935] dark:bg-[#2A2725] dark:text-[#F5F3F0] dark:hover:bg-[#3D3935]"
    >
      {text}
    </button>
  );
}
