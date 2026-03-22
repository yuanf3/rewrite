import * as api from "@/api/client";
import type { Message, ToolStep } from "@/types";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function useMessages(activeId: string | null) {
  const [messageMap, setMessageMap] = useState<Record<string, Message[]>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingSet, setSendingSet] = useState<Set<string>>(new Set());
  const [stepsMap, setStepsMap] = useState<Record<string, ToolStep[]>>({});
  const loadedRef = useRef<Set<string>>(new Set());

  const messages = activeId ? (messageMap[activeId] ?? []) : [];
  const sending = activeId ? sendingSet.has(activeId) : false;
  const activeSteps = activeId ? (stepsMap[activeId] ?? []) : [];

  function setMsgs(id: string, fn: (prev: Message[]) => Message[]) {
    setMessageMap((map) => ({ ...map, [id]: fn(map[id] ?? []) }));
  }

  useEffect(() => {
    if (!activeId) return;
    if (loadedRef.current.has(activeId)) {
      setLoadingMessages(false);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    api
      .getMessages(activeId)
      .then((msgs) => {
        if (cancelled) return;
        loadedRef.current.add(activeId);
        setMsgs(activeId, () => msgs);
      })
      .catch(() => !cancelled && toast.error("Failed to load messages"))
      .finally(() => !cancelled && setLoadingMessages(false));
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  function dropMessages(id: string) {
    loadedRef.current.delete(id);
    setMessageMap((map) => {
      const next = { ...map };
      delete next[id];
      return next;
    });
  }

  function clearAll() {
    loadedRef.current.clear();
    setMessageMap({});
  }

  async function send(
    convId: string,
    content: string,
    files: File[],
    onComplete?: () => void
  ) {
    try {
      // Prevent the message-loading effect from refetching mid-send
      loadedRef.current.add(convId);

      let fileIds: string[] | undefined;
      if (files.length > 0) {
        const results = await Promise.all(
          files.map((f) => api.uploadFile(convId, f))
        );
        const ready = results
          .filter((r) => r.status === "ready")
          .map((r) => r.file_id);
        if (ready.length > 0) fileIds = ready;
        const failCount = results.length - ready.length;
        if (failCount > 0)
          toast.error(`${failCount} file(s) failed to process`);
      }

      setSendingSet((prev) => new Set(prev).add(convId));
      const optimisticId = `optimistic-${crypto.randomUUID()}`;
      setMsgs(convId, (prev) => [
        ...prev,
        {
          id: optimisticId,
          conversation_id: convId,
          role: "user",
          content,
          files: [],
          steps: [],
          created_at: new Date().toISOString(),
        },
      ]);

      try {
        await api.sendMessageStream(
          convId,
          { content, file_ids: fileIds },
          {
            onStep(step) {
              setStepsMap((prev) => ({
                ...prev,
                [convId]: [...(prev[convId] ?? []), step],
              }));
            },
            onDone(pair) {
              setMsgs(convId, (prev) => [
                ...prev.filter((m) => m.id !== optimisticId),
                pair.user_message,
                pair.assistant_message,
              ]);
              setStepsMap((prev) => {
                const next = { ...prev };
                delete next[convId];
                return next;
              });
              onComplete?.();
            },
            onError(detail) {
              setMsgs(convId, (prev) =>
                prev.filter((m) => m.id !== optimisticId)
              );
              setStepsMap((prev) => {
                const next = { ...prev };
                delete next[convId];
                return next;
              });
              toast.error(detail);
            },
          }
        );
      } catch (err) {
        setMsgs(convId, (prev) => prev.filter((m) => m.id !== optimisticId));
        setStepsMap((prev) => {
          const next = { ...prev };
          delete next[convId];
          return next;
        });
        throw err;
      } finally {
        setSendingSet((prev) => {
          const next = new Set(prev);
          next.delete(convId);
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
    messages,
    loadingMessages,
    sending,
    sendingIds: sendingSet,
    activeSteps,
    send,
    dropMessages,
    clearAll,
  };
}
