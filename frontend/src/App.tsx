import * as api from "@/api/client";
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

export default function App() {
  const convos = useConversations();
  const msgs = useMessages(convos.activeId);

  async function handleSend(content: string, files: File[]) {
    let convId = convos.activeId;
    const needsTitle =
      !convId || !convos.conversations.find((c) => c.id === convId)?.title;

    if (!convId) {
      const conv = await api.createConversation();
      convos.addConversation(conv);
      convos.selectConversation(conv.id);
      convId = conv.id;
    }

    await msgs.send(
      convId,
      content,
      files,
      needsTitle
        ? () => convos.updateTitle(convId!, content.slice(0, 80))
        : undefined
    );
  }

  async function handleDelete(id: string) {
    await convos.deleteConversation(id);
    msgs.dropMessages(id);
  }

  async function handleDeleteAll() {
    await convos.deleteAllConversations();
    msgs.clearAll();
  }

  async function handleClear(id: string) {
    await api.clearConversation(id);
    msgs.dropMessages(id);
  }

  return (
    <SidebarProvider className="h-svh !min-h-0">
      <AppSidebar
        conversations={convos.conversations}
        loading={convos.loading}
        activeId={convos.activeId}
        onSelect={convos.selectConversation}
        onNew={() => convos.selectConversation(null)}
        onDelete={handleDelete}
        onClear={handleClear}
        onDeleteAll={handleDeleteAll}
        sendingIds={msgs.sendingIds}
      />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          {convos.activeId && (
            <h1 className="truncate font-semibold">
              {convos.conversations.find((c) => c.id === convos.activeId)
                ?.title ?? "New Conversation"}
            </h1>
          )}
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">
          {convos.activeId ? (
            <ChatArea
              messages={msgs.messages}
              loading={msgs.loadingMessages}
              sending={msgs.sending}
              activeSteps={msgs.activeSteps}
              streamingContent={msgs.streamingContent}
            />
          ) : (
            <WelcomeScreen />
          )}
          <MessageInput
            onSend={handleSend}
            disabled={msgs.sending}
            focusTrigger={convos.focusTrigger}
          />
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
