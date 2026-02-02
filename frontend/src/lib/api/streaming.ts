import { useCallback, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import {
  useSendMessageMutation,
  useCreateConversationMutation,
} from "./chat";

// =============================================================================
// Types
// =============================================================================

export interface StreamingOptions {
  /** Called when streaming starts */
  onStart?: () => void;
  /** Called when streaming completes successfully */
  onComplete?: (fullContent: string) => void;
  /** Called when an error occurs */
  onError?: (error: string) => void;
}

// =============================================================================
// Hook: useChatStreaming
// =============================================================================

/**
 * Hook that integrates chat API streaming with the Zustand store.
 * Handles conversation creation, message sending, and streaming state.
 */
export function useChatStreaming(options?: StreamingOptions) {
  const {
    currentConversationId,
    selectConversation,
    appendStreamingContent,
    finalizeStreaming,
    clearStreaming,
  } = useChatStore();

  const sendMessageMutation = useSendMessageMutation();
  const createConversationMutation = useCreateConversationMutation();

  // Track accumulated content for finalizeStreaming
  const accumulatedContentRef = useRef("");

  /**
   * Send a message and handle streaming response.
   * Creates a new conversation if none is selected.
   */
  const sendMessage = useCallback(
    async (content: string) => {
      // Reset accumulated content
      accumulatedContentRef.current = "";

      options?.onStart?.();

      try {
        // Create conversation if needed
        let conversationId = currentConversationId;
        if (!conversationId) {
          const newConversation =
            await createConversationMutation.mutateAsync();
          conversationId = newConversation.id;
          selectConversation(conversationId);
        }

        // Send message with streaming callbacks
        await sendMessageMutation.mutateAsync({
          conversationId,
          message: { content },
          options: {
            onChunk: (chunk: string) => {
              accumulatedContentRef.current += chunk;
              appendStreamingContent(chunk);
            },
            onComplete: () => {
              const fullContent = accumulatedContentRef.current;
              const messageId = `msg-${Date.now()}`;
              finalizeStreaming(fullContent, messageId);
              options?.onComplete?.(fullContent);
            },
            onError: (error: string) => {
              clearStreaming();
              options?.onError?.(error);
            },
          },
        });
      } catch (error) {
        clearStreaming();
        const errorMessage =
          error instanceof Error ? error.message : "Failed to send message";
        options?.onError?.(errorMessage);
      }
    },
    [
      currentConversationId,
      selectConversation,
      appendStreamingContent,
      finalizeStreaming,
      clearStreaming,
      sendMessageMutation,
      createConversationMutation,
      options,
    ]
  );

  return {
    sendMessage,
    isLoading:
      sendMessageMutation.isPending || createConversationMutation.isPending,
    error: sendMessageMutation.error || createConversationMutation.error,
  };
}
