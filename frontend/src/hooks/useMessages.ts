import * as api from "@/api/client";
import type { Message } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { USER_ID } from "./useConversations";

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  // Prevents a race where setActiveId fires a getMessages fetch that overlaps with an in-flight send.
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    // Skip fetch when a send is in-flight (e.g. new conversation just created)
    if (sendingRef.current) return;
    setLoading(true);
    api
      .getMessages(conversationId)
      .then(setMessages)
      .catch((err) => console.error("Failed to load messages", err))
      .finally(() => setLoading(false));
  }, [conversationId]);

  const send = useCallback(
    async (convId: string, content: string, fileIds?: string[]) => {
      sendingRef.current = true;
      setSending(true);
      // Optimistically append the user message so the UI responds immediately,
      // then replace it with the real message (+ assistant reply) once the API responds.
      const optimisticMsg: Message = {
        id: `optimistic-${Date.now()}`,
        conversation_id: convId,
        role: "user",
        content,
        files: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      try {
        const pair = await api.sendMessage(convId, {
          content,
          user_id: USER_ID,
          file_ids: fileIds,
        });
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticMsg.id),
          pair.user_message,
          pair.assistant_message,
        ]);
        return pair;
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    []
  );

  const reset = useCallback(() => setMessages([]), []);

  return { messages, loading, sending, send, reset };
}
