import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Message } from "@/types";
import { Check, Copy, Paperclip } from "lucide-react";
import { useRef, useState } from "react";

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    if (timerRef.current) clearTimeout(timerRef.current);
    setCopied(true);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`group/msg flex w-full min-w-0 flex-col ${isUser ? "items-end" : "items-start"}`}
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
              <Badge
                key={f.file_id}
                variant="secondary"
                className="gap-1 text-xs"
              >
                <Paperclip className="size-3" />
                {f.filename}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {message.content && (
        <Button
          variant="ghost"
          size="icon"
          className={`size-6 group-hover/msg:opacity-100 ${isUser && "opacity-0"}`}
          onClick={handleCopy}
          title="Copy"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}
