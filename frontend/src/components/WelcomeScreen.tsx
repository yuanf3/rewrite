import { MessageSquare } from "lucide-react";

export function WelcomeScreen() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <MessageSquare className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">Welcome</h2>
        <p className="mt-2 text-muted-foreground">
          Start a conversation by typing a message below.
        </p>
      </div>
    </div>
  );
}
