import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import type { Conversation } from "@/types";
import { Eraser, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function AppSidebar({
  conversations,
  loading,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClear,
}: {
  conversations: Conversation[];
  loading: boolean;
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClear: (id: string) => void;
}) {
  return (
    <Sidebar>
      <SidebarHeader>
        <Button onClick={onNew} variant="outline">
          <Plus />
          New conversation
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  ))
                : conversations.map((conv) => (
                    <SidebarMenuItem key={conv.id}>
                      <SidebarMenuButton
                        isActive={conv.id === activeId}
                        onClick={() => onSelect(conv.id)}
                      >
                        <span className="truncate">
                          {conv.title ?? "New conversation"}
                        </span>
                      </SidebarMenuButton>
                      <div className="absolute top-1.5 right-1 flex gap-0.5 opacity-0 hover:opacity-100">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="size-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.promise(async () => onClear(conv.id), {
                              loading: "Clearing...",
                              success: "Cleared",
                              error: "Failed to clear",
                            });
                          }}
                          title="Clear messages"
                        >
                          <Eraser className="size-3.5" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="size-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.promise(async () => onDelete(conv.id), {
                              loading: "Deleting...",
                              success: "Deleted",
                              error: "Failed to delete",
                            });
                          }}
                          title="Delete conversation"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </SidebarMenuItem>
                  ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
