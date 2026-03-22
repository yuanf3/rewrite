import * as api from "@/api/client";
import type { Conversation } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusTrigger, setFocusTrigger] = useState(0);

  useEffect(() => {
    api
      .listConversations()
      .then(setConversations)
      .catch(() => toast.error("Failed to load conversations"))
      .finally(() => setLoading(false));
  }, []);

  function selectConversation(id: string | null) {
    setActiveId(id);
    setFocusTrigger((n) => n + 1);
  }

  function addConversation(conv: Conversation) {
    setConversations((prev) => [conv, ...prev]);
  }

  function updateTitle(id: string, title: string) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  }

  async function deleteConversation(id: string) {
    await api.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) selectConversation(null);
  }

  async function deleteAllConversations() {
    await api.deleteAllConversations();
    setConversations([]);
    selectConversation(null);
  }

  return {
    conversations,
    activeId,
    loading,
    focusTrigger,
    selectConversation,
    addConversation,
    updateTitle,
    deleteConversation,
    deleteAllConversations,
  };
}
