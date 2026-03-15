import { AppSidebar } from "@/components/AppSidebar";
import { ChatArea } from "@/components/ChatArea";
import { MessageInput } from "@/components/MessageInput";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useState } from "react";
import { toast } from "sonner";

export default function App() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const convos = useConversations();
  const msgs = useMessages(activeId);

  const handleNew = () => {
    setActiveId(null);
    setFocusTrigger((n) => n + 1);
  };

  const handleDelete = async (id: string) => {
    await convos.remove(id);
    if (activeId === id) {
      handleNew();
    }
  };

  const handleClear = async (id: string) => {
    await convos.clear(id);
    if (activeId === id) msgs.reset();
  };

  const handleSend = async (content: string) => {
    try {
      let convId = activeId;

      if (!convId) {
        const conv = await convos.create();
        convId = conv.id;
        setActiveId(convId);
      }

      // Track whether this is the first message (title not yet set)
      const isNew = !convos.conversations.find((c) => c.id === convId)?.title;

      await msgs.send(convId, content);

      if (isNew) {
        convos.updateConversation(convId, {
          title: content.slice(0, 80),
        });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send message"
      );
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar
        conversations={convos.conversations}
        loading={convos.loading}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNew}
        onDelete={handleDelete}
        onClear={handleClear}
      />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          {activeId && (
            <h1 className="truncate font-semibold">
              {convos.conversations.find((c) => c.id === activeId)?.title ??
                "Conversation"}
            </h1>
          )}
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">
          {activeId ? (
            <ChatArea messages={msgs.messages} loading={msgs.loading} />
          ) : (
            <WelcomeScreen />
          )}
          <MessageInput
            onSend={handleSend}
            disabled={msgs.sending}
            focusTrigger={focusTrigger}
          />
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
