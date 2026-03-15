import type { Message } from "@/types";

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex w-full min-w-0 ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={
          isUser
            ? "max-w-[75%] min-w-0 rounded-lg bg-primary px-4 py-2 text-primary-foreground"
            : "max-w-[75%] min-w-0 rounded-lg bg-muted px-4 py-2"
        }
      >
        <p className="break-words whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
