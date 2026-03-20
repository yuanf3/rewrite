import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { Message, ToolStep } from "@/types";
import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";
import { StepList } from "./StepList";
import { TypingIndicator } from "./TypingIndicator";

export function ChatArea({
  messages,
  loading,
  sending,
  activeSteps,
}: {
  messages: Message[];
  loading: boolean;
  sending: boolean;
  activeSteps: ToolStep[];
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
  }, [messages, activeSteps]);

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
        {sending && activeSteps.length > 0 && <StepList steps={activeSteps} />}
        {sending && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
