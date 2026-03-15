import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { Message } from "@/types";
import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";

export function ChatArea({
  messages,
  loading,
}: {
  messages: Message[];
  loading: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);

  // Only show skeleton after a delay
  useEffect(() => {
    const id = setTimeout(() => setShowSkeleton(loading), loading ? 150 : 0);
    return () => clearTimeout(id);
  }, [loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (showSkeleton) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-1/2" />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 overflow-x-hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
