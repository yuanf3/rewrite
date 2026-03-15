import { Badge } from "@/components/ui/badge";
import type { Message } from "@/types";
import { Paperclip } from "lucide-react";

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
        {message.files.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.files.map((f) => (
              <Badge key={f.file_id} variant="outline" className="gap-1 text-xs">
                <Paperclip className="size-3" />
                {f.filename}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
