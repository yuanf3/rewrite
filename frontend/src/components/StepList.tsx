import { Badge } from "@/components/ui/badge";
import type { ToolStep } from "@/types";
import { ChevronRight, Wrench } from "lucide-react";

function truncate(text: string, max = 120) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function StepItem({ step }: { step: ToolStep }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Wrench className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <Badge variant="outline" className="mr-1.5 text-[10px]">
          {step.tool_name}
        </Badge>
        <span className="text-muted-foreground">
          {truncate(JSON.stringify(step.tool_input))}
        </span>
        {step.result && (
          <p className="mt-0.5 text-muted-foreground/70">
            → {truncate(step.result)}
          </p>
        )}
      </div>
    </div>
  );
}

export function StepList({
  steps,
  collapsible = false,
}: {
  steps: ToolStep[];
  collapsible?: boolean;
}) {
  if (steps.length === 0) return null;

  const content = (
    <div className="flex flex-col gap-1.5">
      {steps.map((step, i) => (
        <StepItem key={i} step={step} />
      ))}
    </div>
  );

  if (!collapsible) {
    return <div className="mb-1.5 max-w-[75%]">{content}</div>;
  }

  return (
    <details className="group/steps mb-1.5 max-w-[75%]">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground">
        <ChevronRight className="size-3 transition-transform group-open/steps:rotate-90" />
        {steps.length} tool step{steps.length !== 1 && "s"}
      </summary>
      <div className="mt-1 ml-4">{content}</div>
    </details>
  );
}
