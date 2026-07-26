"use client";

import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/queries/notifications";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const queryClient = useQueryClient();
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    refetchInterval: 60_000,
  });

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  async function handleMarkAll() {
    await markAllNotificationsRead();
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function handleClick(id: string) {
    await markNotificationRead(id);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <button onClick={handleMarkAll} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <CheckCheck className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <Separator />
        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {!notifications?.length && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up</p>
          )}
          {notifications?.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n.id)}
              className={cn(
                "flex w-full flex-col gap-0.5 border-b border-border/60 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-accent",
                !n.isRead && "bg-primary/5",
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className={cn("leading-snug", !n.isRead && "font-medium")}>{n.title}</span>
                {!n.isRead && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
              </span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
