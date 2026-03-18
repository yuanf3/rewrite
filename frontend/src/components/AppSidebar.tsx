import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { useKeycloak } from "@react-keycloak/web";
import { DatabaseZap, Eraser, LogOut, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function AppSidebar({
  conversations,
  loading,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClear,
  onDeleteAll,
  sendingIds,
}: {
  conversations: Conversation[];
  loading: boolean;
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClear: (id: string) => void;
  onDeleteAll: () => Promise<void>;
  sendingIds: Set<string>;
}) {
  const { keycloak } = useKeycloak();

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
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
                    <SidebarMenuItem key={conv.id} className="group/item">
                      <SidebarMenuButton
                        isActive={conv.id === activeId}
                        onClick={() => onSelect(conv.id)}
                        className="pr-14"
                      >
                        <span className="truncate">
                          {conv.title ?? "New conversation"}
                        </span>
                        {sendingIds.has(conv.id) && (
                          <span className="ml-auto inline-flex h-full shrink-0 items-center gap-0.5">
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="size-1 animate-bounce rounded-full bg-current"
                                style={{ animationDelay: `${i * 0.15}s` }}
                              />
                            ))}
                          </span>
                        )}
                      </SidebarMenuButton>
                      <div className="absolute inset-y-0 right-1 flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="size-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.promise(async () => onClear(conv.id), {
                              loading: "Clearing...",
                              success: "Conversation cleared",
                              error: "Failed to clear conversation",
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
                              success: "Conversation deleted",
                              error: "Failed to delete conversation",
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
      <SidebarFooter className="border-t">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => keycloak.logout()}
        >
          <LogOut className="size-4" />
          Log out
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full text-destructive"
              disabled={loading || conversations.length === 0}
            >
              <DatabaseZap className="size-4" />
              Clear database
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Clear database</DialogTitle>
            <DialogDescription>
              This will permanently delete all conversations, message history
              and files. This action cannot be undone.
            </DialogDescription>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="destructive"
                  onClick={() => {
                    toast.promise(onDeleteAll, {
                      loading: "Clearing database...",
                      success: "All conversations deleted",
                      error: "Failed to clear database",
                    });
                  }}
                >
                  Delete all
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarFooter>
    </Sidebar>
  );
}
