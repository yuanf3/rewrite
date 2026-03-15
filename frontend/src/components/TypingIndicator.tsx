export function TypingIndicator() {
  return (
    <div className="flex w-full justify-start">
      <div className="flex items-center gap-1.5 rounded-lg bg-muted px-4 py-3">
        <span className="bg-muted-foreground/60 size-2 animate-bounce rounded-full [animation-delay:0ms]" />
        <span className="bg-muted-foreground/60 size-2 animate-bounce rounded-full [animation-delay:150ms]" />
        <span className="bg-muted-foreground/60 size-2 animate-bounce rounded-full [animation-delay:300ms]" />
      </div>
    </div>
  );
}
