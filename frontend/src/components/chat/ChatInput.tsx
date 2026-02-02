"use client";

import { useState, useRef, useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";

// =============================================================================
// Types
// =============================================================================

export interface ChatInputProps {
  /** Callback when message is submitted */
  onSendMessage?: (content: string) => void;
  /** Optional className for additional styling */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ChatInput is the message input field with send button.
 * Supports Enter to send and Shift+Enter for newlines.
 * Disabled while streaming.
 */
export function ChatInput({ onSendMessage, className }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isStreaming, addMessage } = useChatStore();

  const handleSubmit = useCallback(() => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isStreaming) return;

    // Add user message to store for immediate display
    addMessage({
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmedMessage,
      created_at: new Date().toISOString(),
    });

    // Call the onSendMessage callback for API integration
    onSendMessage?.(trimmedMessage);

    // Clear input
    setMessage("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [message, isStreaming, addMessage, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift sends message
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Shift+Enter allows newline (default behavior)
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  const isDisabled = isStreaming || !message.trim();

  return (
    <div
      className={`
        flex items-end gap-2 px-4 py-3
        border-t border-[#DEDDDB] dark:border-[#3D3935]
        ${className ?? ""}
      `}
    >
      {/* Text input */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your nutrition..."
          disabled={isStreaming}
          rows={1}
          className={`
            w-full px-4 py-2 resize-none
            rounded-2xl border border-[#DEDDDB]
            bg-[#FDFBF7] text-[#4A4543]
            placeholder-[#A89B86]
            dark:border-[#3D3935] dark:bg-[#2A2725]
            dark:text-[#F5F3F0] dark:placeholder-[#8B7E6F]
            focus:outline-none focus:ring-2 focus:ring-[#E8A0BF] focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          `}
          style={{ maxHeight: "120px" }}
        />
      </div>

      {/* Send button */}
      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        aria-label="Send message"
        className={`
          flex items-center justify-center
          h-10 w-10 rounded-full
          bg-[#E8A0BF] text-white
          transition-all duration-200
          hover:bg-[#D88FAE] hover:scale-105
          active:scale-95
          disabled:opacity-50 disabled:cursor-not-allowed
          disabled:hover:scale-100 disabled:hover:bg-[#E8A0BF]
        `}
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
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
      </button>
    </div>
  );
}
