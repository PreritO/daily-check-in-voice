import { create } from "zustand";
import type { Conversation, Message } from "@/lib/api/chat";

// =============================================================================
// State Interface
// =============================================================================

interface ChatState {
  // UI State
  isOpen: boolean;
  currentConversationId: string | null;

  // Data (local cache, synced from React Query + streaming)
  conversations: Conversation[];
  messages: Message[];

  // Streaming state
  isStreaming: boolean;
  streamingContent: string;
}

// =============================================================================
// Actions Interface
// =============================================================================

interface ChatActions {
  // Panel toggle actions
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;

  // Conversation management
  selectConversation: (id: string | null) => void;
  startNewConversation: () => void;

  // Message management
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;

  // Streaming actions
  appendStreamingContent: (chunk: string) => void;
  finalizeStreaming: (fullContent: string, messageId: string) => void;
  clearStreaming: () => void;

  // Data sync (for React Query integration)
  setConversations: (conversations: Conversation[]) => void;
}

// =============================================================================
// Store Type
// =============================================================================

type ChatStore = ChatState & ChatActions;

// =============================================================================
// Store Implementation
// =============================================================================

export const useChatStore = create<ChatStore>((set) => ({
  // Initial state
  isOpen: false,
  currentConversationId: null,
  conversations: [],
  messages: [],
  isStreaming: false,
  streamingContent: "",

  // Panel toggle actions
  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),

  openChat: () => set({ isOpen: true }),

  closeChat: () => set({ isOpen: false }),

  // Conversation management
  selectConversation: (id) =>
    set({
      currentConversationId: id,
      messages: [], // Clear messages, will be fetched by React Query
      streamingContent: "",
      isStreaming: false,
    }),

  startNewConversation: () =>
    set({
      currentConversationId: null,
      messages: [],
      streamingContent: "",
      isStreaming: false,
    }),

  // Message management
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setMessages: (messages) => set({ messages }),

  // Streaming actions
  appendStreamingContent: (chunk) =>
    set((state) => ({
      isStreaming: true,
      streamingContent: state.streamingContent + chunk,
    })),

  finalizeStreaming: (fullContent, messageId) =>
    set((state) => ({
      isStreaming: false,
      streamingContent: "",
      // Deduplicate: only add if message with this ID doesn't already exist
      messages: state.messages.some((m) => m.id === messageId)
        ? state.messages
        : [
            ...state.messages,
            {
              id: messageId,
              role: "assistant" as const,
              content: fullContent,
              created_at: new Date().toISOString(),
            },
          ],
    })),

  clearStreaming: () =>
    set({
      isStreaming: false,
      streamingContent: "",
    }),

  // Data sync
  setConversations: (conversations) => set({ conversations }),
}));
