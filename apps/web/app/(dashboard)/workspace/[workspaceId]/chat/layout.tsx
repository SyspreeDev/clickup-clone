"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Hash, Lock } from "lucide-react";
import { listChannels } from "@/lib/queries/chat";
import { CreateChannelDialog } from "@/components/chat/create-channel-dialog";
import { TopNav } from "@/components/layout/top-nav";
import { cn } from "@/lib/utils";

export default function ChatLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const pathname = usePathname();
  const { data: channels } = useQuery({ queryKey: ["channels", workspaceId], queryFn: () => listChannels(workspaceId) });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopNav title="Chat" />
      <div className="flex min-h-0 flex-1">
        <div className="flex w-56 shrink-0 flex-col border-r border-border">
          <div className="flex items-center justify-between px-3 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Channels</span>
            <CreateChannelDialog workspaceId={workspaceId} />
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto px-2 scrollbar-thin">
            {channels?.map((channel) => {
              const href = `/workspace/${workspaceId}/chat/${channel.id}`;
              const active = pathname === href;
              return (
                <Link
                  key={channel.id}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                    active ? "bg-primary/10 text-primary font-medium" : "text-foreground/80 hover:bg-accent",
                  )}
                >
                  {channel.type === "PRIVATE" ? <Lock className="h-3.5 w-3.5" /> : <Hash className="h-3.5 w-3.5" />}
                  <span className="truncate">{channel.name ?? "Direct message"}</span>
                </Link>
              );
            })}
            {!channels?.length && <p className="px-2 py-1 text-xs text-muted-foreground">No channels yet</p>}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
