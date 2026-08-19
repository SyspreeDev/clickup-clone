"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { listAiConversations, deleteAiConversation } from "@/lib/queries/ai";
import { cn } from "@/lib/utils";

export default function AiLayout({ children, params }: { children: React.ReactNode; params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const base = `/workspace/${workspaceId}/ai`;

  const { data: conversations } = useQuery({
    queryKey: ["ai-conversations", workspaceId],
    queryFn: () => listAiConversations(workspaceId),
    refetchInterval: 15_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAiConversation(workspaceId, id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["ai-conversations", workspaceId] });
      toast.success("Chat deleted");
      if (pathname === `${base}/${id}`) router.push(base);
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopNav title="AI Assistant" />
      <div className="flex min-h-0 flex-1">
        <div className="flex w-60 shrink-0 flex-col border-r border-border">
          <div className="p-2">
            <Link
              href={base}
              className="flex items-center gap-2 rounded-lg border border-dashed border-border px-2.5 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              New chat
            </Link>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2 scrollbar-thin">
            {!conversations?.length && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">Your chats will show up here</p>
            )}
            {conversations?.map((c) => {
              const href = `${base}/${c.id}`;
              const active = pathname === href;
              return (
                <Link
                  key={c.id}
                  href={href}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                    active ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-accent",
                  )}
                >
                  <Sparkles className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground group-hover:hidden">
                    {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: false })}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (window.confirm(`Delete "${c.title}"? This can't be undone.`)) deleteMutation.mutate(c.id);
                    }}
                    className="hidden shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
