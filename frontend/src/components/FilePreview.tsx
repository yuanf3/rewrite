import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export function FilePreview({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pb-2">
      {files.map((file, i) => (
        <Badge key={i} variant="secondary" className="gap-1">
          {file.name}
          <button onClick={() => onRemove(i)}>
            <X className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
