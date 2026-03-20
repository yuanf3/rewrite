import * as api from "@/api/client";
import type { Conversation, Message, ToolStep } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messageMap, setMessageMap] = useState<Record<string, Message[]>>({});
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingSet, setSendingSet] = useState<Set<string>>(new Set());
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [stepsMap, setStepsMap] = useState<Record<string, ToolStep[]>>({});

  const messages = activeId ? (messageMap[activeId] ?? []) : [];
  const sending = activeId ? sendingSet.has(activeId) : false;
  const activeSteps = activeId ? (stepsMap[activeId] ?? []) : [];

  function setMsgs(id: string, fn: (prev: Message[]) => Message[]) {
    setMessageMap((map) => ({ ...map, [id]: fn(map[id] ?? []) }));
  }

  useEffect(() => {
    api
      .listConversations()
      .then(setConversations)
      .catch(() => toast.error("Failed to load conversations"))
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
      .catch(() => !cancelled && toast.error("Failed to load messages"))
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
    await api.deleteAllConversations();
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
        const conv = await api.createConversation();
        setConversations((prev) => [conv, ...prev]);
        convId = conv.id;
        setActiveId(convId);
      }

      let fileIds: string[] | undefined;
      if (files.length > 0) {
        const results = await Promise.all(
          files.map((f) => api.uploadFile(convId!, f)),
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
          steps: [],
          created_at: new Date().toISOString(),
        },
      ]);

      const streamConvId = convId;
      try {
        await api.sendMessageStream(
          streamConvId,
          { content, file_ids: fileIds },
          {
            onStep(step) {
              setStepsMap((prev) => ({
                ...prev,
                [streamConvId]: [...(prev[streamConvId] ?? []), step],
              }));
            },
            onDone(pair) {
              setMsgs(streamConvId, (prev) => [
                ...prev.filter((m) => m.id !== optimisticId),
                pair.user_message,
                pair.assistant_message,
              ]);
              setStepsMap((prev) => {
                const next = { ...prev };
                delete next[streamConvId];
                return next;
              });
              if (needsTitle) {
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === streamConvId
                      ? { ...c, title: content.slice(0, 80) }
                      : c,
                  ),
                );
              }
            },
            onError(detail) {
              setMsgs(streamConvId, (prev) =>
                prev.filter((m) => m.id !== optimisticId),
              );
              setStepsMap((prev) => {
                const next = { ...prev };
                delete next[streamConvId];
                return next;
              });
              toast.error(detail);
            },
          },
        );
      } catch (err) {
        setMsgs(streamConvId, (prev) =>
          prev.filter((m) => m.id !== optimisticId),
        );
        setStepsMap((prev) => {
          const next = { ...prev };
          delete next[streamConvId];
          return next;
        });
        throw err;
      } finally {
        setSendingSet((prev) => {
          const next = new Set(prev);
          next.delete(streamConvId);
          return next;
        });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send message",
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
    activeSteps,
    selectConversation,
    deleteConversation,
    deleteAllConversations,
    clearConversation,
    send,
  };
}
