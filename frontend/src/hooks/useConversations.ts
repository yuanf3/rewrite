import * as api from "@/api/client";
import type { Conversation } from "@/types";
import { useCallback, useEffect, useState } from "react";

const USER_ID = "default-user";

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listConversations(USER_ID);
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async () => {
    const conv = await api.createConversation(USER_ID);
    setConversations((prev) => [conv, ...prev]);
    return conv;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clear = useCallback(async (id: string) => {
    await api.clearConversation(id);
  }, []);

  const removeAll = useCallback(async () => {
    await api.deleteAllConversations(USER_ID);
    setConversations([]);
  }, []);

  const updateConversation = useCallback(
    (id: string, updates: Partial<Conversation>) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      );
    },
    []
  );

  return {
    conversations,
    loading,
    create,
    remove,
    removeAll,
    clear,
    refresh,
    updateConversation,
  };
}

export { USER_ID };
