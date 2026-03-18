import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, SendHorizonal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FilePreview } from "./FilePreview";

const ACCEPTED_TYPES = ".pdf,.txt,.md,.docx";

export function MessageInput({
  onSend,
  disabled,
  focusTrigger,
}: {
  onSend: (content: string, files: File[]) => void;
  disabled: boolean;
  focusTrigger?: number;
}) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [focusTrigger]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if ((!trimmed && files.length === 0) || disabled) return;
    onSend(trimmed, files);
    setValue("");
    setFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="border-t p-4">
      <FilePreview files={files} onRemove={removeFile} />
      <div className="flex gap-2">
        <Button
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="Attach files"
        >
          <Paperclip />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Processing..." : "Type a message..."}
          disabled={disabled}
          rows={1}
          className="resize-none"
        />
        <Button
          onClick={handleSubmit}
          disabled={disabled || (!value.trim() && files.length === 0)}
          size="icon"
          title="Send"
        >
          <SendHorizonal />
        </Button>
      </div>
    </div>
  );
}
