import * as api from "@/api/client";
import type { Conversation, Message } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const USER_ID = "default-user";

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [focusTrigger, setFocusTrigger] = useState(0);

  useEffect(() => {
    api
      .listConversations(USER_ID)
      .then(setConversations)
      .catch((err) => console.error("Failed to load conversations", err))
      .finally(() => setLoadingConversations(false));
  }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    api
      .getMessages(activeId)
      .then((msgs) => !cancelled && setMessages(msgs))
      .catch((err) => !cancelled && console.error("Failed to load messages", err))
      .finally(() => !cancelled && setLoadingMessages(false));
    return () => { cancelled = true; };
  }, [activeId]);

  function deselect() {
    setActiveId(null);
    setFocusTrigger((n) => n + 1);
  }

  async function deleteConversation(id: string) {
    await api.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) deselect();
  }

  async function deleteAllConversations() {
    await api.deleteAllConversations(USER_ID);
    setConversations([]);
    deselect();
  }

  async function clearConversation(id: string) {
    await api.clearConversation(id);
    if (activeId === id) setMessages([]);
  }

  async function send(content: string, files: File[]) {
    try {
      let convId = activeId;
      const isNew = !convId || !conversations.find((c) => c.id === convId)?.title;

      if (!convId) {
        const conv = await api.createConversation(USER_ID);
        setConversations((prev) => [conv, ...prev]);
        convId = conv.id;
        setActiveId(convId);
      }

      let fileIds: string[] | undefined;
      if (files.length > 0) {
        const results = await Promise.all(files.map((f) => api.uploadFile(convId!, f)));
        const ready = results.filter((r) => r.status === "ready").map((r) => r.file_id);
        if (ready.length > 0) fileIds = ready;
        const failCount = results.length - ready.length;
        if (failCount > 0) toast.warning(`${failCount} file(s) failed to process`);
      }

      setSending(true);
      const optimisticId = `optimistic-${crypto.randomUUID()}`;
      setMessages((prev) => [
        ...prev,
        { id: optimisticId, conversation_id: convId!, role: "user", content, files: [], created_at: new Date().toISOString() },
      ]);

      try {
        const pair = await api.sendMessage(convId!, { content, user_id: USER_ID, file_ids: fileIds });
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticId),
          pair.user_message,
          pair.assistant_message,
        ]);
        if (isNew) {
          setConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, title: content.slice(0, 80) } : c)),
          );
        }
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      } finally {
        setSending(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    }
  }

  return {
    conversations,
    activeId,
    messages,
    loadingConversations,
    loadingMessages,
    sending,
    focusTrigger,
    selectConversation: (id: string | null) => { setActiveId(id); if (!id) setFocusTrigger((n) => n + 1); },
    deleteConversation,
    deleteAllConversations,
    clearConversation,
    send,
  };
}
