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
import { useChat } from "@/hooks/useChat";

export default function App() {
  const chat = useChat();

  return (
    <SidebarProvider className="h-svh !min-h-0">
      <AppSidebar
        conversations={chat.conversations}
        loading={chat.loadingConversations}
        activeId={chat.activeId}
        onSelect={chat.selectConversation}
        onNew={() => chat.selectConversation(null)}
        onDelete={chat.deleteConversation}
        onClear={chat.clearConversation}
        onDeleteAll={chat.deleteAllConversations}
      />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          {chat.activeId && (
            <h1 className="truncate font-semibold">
              {chat.conversations.find((c) => c.id === chat.activeId)?.title ??
                "Conversation"}
            </h1>
          )}
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">
          {chat.activeId ? (
            <ChatArea
              messages={chat.messages}
              loading={chat.loadingMessages}
              sending={chat.sending}
            />
          ) : (
            <WelcomeScreen />
          )}
          <MessageInput
            onSend={chat.send}
            disabled={chat.sending}
            focusTrigger={chat.focusTrigger}
          />
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
