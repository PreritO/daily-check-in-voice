"use client";

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
      {/* ChatHeader - to be implemented in US-021 */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[#DEDDDB] dark:border-[#3D3935]">
        <div className="text-[#4A4543] dark:text-[#F5F3F0] font-medium">
          Nutrition Assistant
        </div>
      </div>

      {/* ChatMessages - to be implemented in US-022 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-center h-full text-[#A89B86] dark:text-[#8B7E6F]">
          Messages Placeholder
        </div>
      </div>

      {/* ChatInput - to be implemented in US-024 */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-[#DEDDDB] dark:border-[#3D3935]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask about your nutrition..."
            disabled
            className="flex-1 px-4 py-2 rounded-full border border-[#DEDDDB] bg-[#FDFBF7] text-[#4A4543] placeholder-[#A89B86] dark:border-[#3D3935] dark:bg-[#2A2725] dark:text-[#F5F3F0] dark:placeholder-[#8B7E6F] focus:outline-none focus:ring-2 focus:ring-[#E8A0BF]"
          />
          <button
            disabled
            className="flex items-center justify-center h-10 w-10 rounded-full bg-[#E8A0BF] text-white disabled:opacity-50"
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
      </div>
    </div>
  );
}
