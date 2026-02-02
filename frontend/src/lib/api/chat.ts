import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import { createClient } from "@/lib/supabase/client";

// =============================================================================
// Types
// =============================================================================

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationWithMessages {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

export interface MessageCreate {
  content: string;
}

export interface ChatStreamChunk {
  content?: string;
  done?: boolean;
  error?: string;
  error_type?: "rate_limit" | "internal";
}

// =============================================================================
// Query Keys
// =============================================================================

export const chatKeys = {
  all: ["chat"] as const,
  conversations: () => [...chatKeys.all, "conversations"] as const,
  conversationsList: () => [...chatKeys.conversations(), "list"] as const,
  conversationDetail: (id: string) =>
    [...chatKeys.conversations(), "detail", id] as const,
};

// =============================================================================
// API Functions
// =============================================================================

async function getConversations(): Promise<Conversation[]> {
  const response = await apiClient.get<Conversation[]>("/chat/conversations");
  return response.data;
}

async function getConversation(id: string): Promise<ConversationWithMessages> {
  const response = await apiClient.get<ConversationWithMessages>(
    `/chat/conversations/${id}`
  );
  return response.data;
}

async function createConversation(): Promise<Conversation> {
  const response = await apiClient.post<Conversation>("/chat/conversations");
  return response.data;
}

async function deleteConversation(id: string): Promise<void> {
  await apiClient.delete(`/chat/conversations/${id}`);
}

// =============================================================================
// Query Hooks
// =============================================================================

export function useConversationsQuery() {
  return useQuery({
    queryKey: chatKeys.conversationsList(),
    queryFn: getConversations,
  });
}

export function useConversationQuery(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: chatKeys.conversationDetail(id),
    queryFn: () => getConversation(id),
    enabled: enabled && !!id,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

export function useCreateConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversationsList() });
    },
  });
}

export function useDeleteConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversationsList() });
    },
  });
}

// =============================================================================
// Streaming Message Mutation
// =============================================================================

export interface SendMessageOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: () => void;
  onError?: (error: string, errorType: string) => void;
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      message,
      options,
    }: {
      conversationId: string;
      message: MessageCreate;
      options?: SendMessageOptions;
    }): Promise<void> => {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      // Get auth token
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `${API_URL}/api/chat/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token && {
              Authorization: `Bearer ${session.access_token}`,
            }),
          },
          body: JSON.stringify(message),
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          throw new Error("Unauthorized");
        }
        if (response.status === 429) {
          throw new Error(
            "Rate limit exceeded. Please wait before sending another message."
          );
        }
        if (response.status === 404) {
          throw new Error("Conversation not found.");
        }
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      // Helper to parse SSE event
      const parseSSEEvent = (event: string): boolean => {
        if (!event.startsWith("data: ")) return true; // continue processing

        const jsonStr = event.slice(6).trim();
        if (!jsonStr) return true;

        try {
          const data: ChatStreamChunk = JSON.parse(jsonStr);

          if (data.error) {
            options?.onError?.(data.error, data.error_type || "internal");
            return false; // stop processing
          }

          if (data.content) {
            options?.onChunk?.(data.content);
          }

          if (data.done) {
            options?.onComplete?.();
          }
        } catch {
          // Skip malformed JSON
        }
        return true;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events (split by double newline)
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          if (!parseSSEEvent(event)) return;
        }
      }

      // Process any remaining buffer content after stream ends
      if (buffer.trim()) {
        parseSSEEvent(buffer);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversationDetail(variables.conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversationsList(),
      });
    },
  });
}
