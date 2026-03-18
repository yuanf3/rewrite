import * as api from "@/api/client";
import type { Conversation, Message } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const USER_ID = "default-user";

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messageMap, setMessageMap] = useState<Record<string, Message[]>>({});
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingSet, setSendingSet] = useState<Set<string>>(new Set());
  const [focusTrigger, setFocusTrigger] = useState(0);

  const messages = activeId ? (messageMap[activeId] ?? []) : [];
  const sending = activeId ? sendingSet.has(activeId) : false;

  function setMsgs(id: string, fn: (prev: Message[]) => Message[]) {
    setMessageMap((map) => ({ ...map, [id]: fn(map[id] ?? []) }));
  }

  useEffect(() => {
    api
      .listConversations(USER_ID)
      .then(setConversations)
      .catch((err) => console.error("Failed to load conversations", err))
      .finally(() => setLoadingConversations(false));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    if (messageMap[activeId]) {
      setLoadingMessages(false);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    api
      .getMessages(activeId)
      .then((msgs) => !cancelled && setMsgs(activeId, () => msgs))
      .catch(
        (err) => !cancelled && console.error("Failed to load messages", err)
      )
      .finally(() => !cancelled && setLoadingMessages(false));
    return () => {
      cancelled = true;
    };
  }, [activeId, messageMap]);

  function selectConversation(id: string | null) {
    setActiveId(id);
    setFocusTrigger((n) => n + 1);
  }

  async function deleteConversation(id: string) {
    await api.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setMessageMap((map) => {
      const result = { ...map };
      delete result[id];
      return result;
    });
    if (activeId === id) selectConversation(null);
  }

  async function deleteAllConversations() {
    await api.deleteAllConversations(USER_ID);
    setConversations([]);
    setMessageMap({});
    selectConversation(null);
  }

  async function clearConversation(id: string) {
    await api.clearConversation(id);
    setMsgs(id, () => []);
  }

  async function send(content: string, files: File[]) {
    try {
      let convId = activeId;
      const needsTitle =
        !convId || !conversations.find((c) => c.id === convId)?.title;

      if (!convId) {
        const conv = await api.createConversation(USER_ID);
        setConversations((prev) => [conv, ...prev]);
        convId = conv.id;
        setActiveId(convId);
      }

      let fileIds: string[] | undefined;
      if (files.length > 0) {
        const results = await Promise.all(
          files.map((f) => api.uploadFile(convId!, f))
        );
        const ready = results
          .filter((r) => r.status === "ready")
          .map((r) => r.file_id);
        if (ready.length > 0) fileIds = ready;
        const failCount = results.length - ready.length;
        if (failCount > 0)
          toast.error(`${failCount} file(s) failed to process`);
      }

      setSendingSet((prev) => new Set(prev).add(convId!));
      const optimisticId = `optimistic-${crypto.randomUUID()}`;
      setMsgs(convId!, (prev) => [
        ...prev,
        {
          id: optimisticId,
          conversation_id: convId!,
          role: "user",
          content,
          files: [],
          created_at: new Date().toISOString(),
        },
      ]);

      try {
        const pair = await api.sendMessage(convId!, {
          content,
          user_id: USER_ID,
          file_ids: fileIds,
        });
        setMsgs(convId!, (prev) => [
          ...prev.filter((m) => m.id !== optimisticId),
          pair.user_message,
          pair.assistant_message,
        ]);
        if (needsTitle) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId ? { ...c, title: content.slice(0, 80) } : c
            )
          );
        }
      } catch {
        setMsgs(convId!, (prev) => prev.filter((m) => m.id !== optimisticId));
        toast.error("Failed to send message");
      } finally {
        setSendingSet((prev) => {
          const next = new Set(prev);
          next.delete(convId!);
          return next;
        });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send message"
      );
    }
  }

  return {
    conversations,
    activeId,
    messages,
    loadingConversations,
    loadingMessages,
    sending,
    sendingIds: sendingSet,
    focusTrigger,
    selectConversation,
    deleteConversation,
    deleteAllConversations,
    clearConversation,
    send,
  };
}
