"use client";

import { useChatStore } from "@/stores/chat-store";

// =============================================================================
// Types
// =============================================================================

export interface ChatSuggestionsProps {
  /** Optional callback when a suggestion is clicked */
  onSuggestionClick?: (suggestion: string) => void;
  /** Optional className for additional styling */
  className?: string;
}

// =============================================================================
// Default Suggestions
// =============================================================================

const DEFAULT_SUGGESTIONS = [
  "Why did I feel bad yesterday?",
  "What did I eat in the last 3 days?",
  "What are my trigger foods?",
  "How's my fiber intake this week?",
  "Compare my good days vs bad days",
  "What should I eat more of?",
];

// =============================================================================
// Component
// =============================================================================

/**
 * ChatSuggestions displays clickable suggestion chips to help users get started.
 * Clicking a suggestion sends it as a message.
 */
export function ChatSuggestions({
  onSuggestionClick,
  className,
}: ChatSuggestionsProps) {
  const { addMessage } = useChatStore();

  const handleClick = (suggestion: string) => {
    // Add the suggestion as a user message
    addMessage({
      id: `temp-${Date.now()}`,
      role: "user",
      content: suggestion,
      created_at: new Date().toISOString(),
    });

    // Call the optional callback for API integration
    onSuggestionClick?.(suggestion);
  };

  return (
    <div className={className}>
      <div className="text-xs text-[#A89B86] dark:text-[#8B7E6F] text-center mb-3">
        Try asking:
      </div>
      <div className="grid grid-cols-2 gap-2">
        {DEFAULT_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => handleClick(suggestion)}
            className="
              px-3 py-2 text-left text-xs
              rounded-lg border border-[#DEDDDB]
              bg-white text-[#4A4543]
              hover:bg-[#F5F3F0] hover:border-[#E8A0BF]
              active:scale-[0.98]
              transition-all duration-150
              dark:border-[#3D3935] dark:bg-[#2A2725]
              dark:text-[#F5F3F0] dark:hover:bg-[#3D3935]
            "
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
