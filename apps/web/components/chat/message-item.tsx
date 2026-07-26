"use client";

import { useState } from "react";
import { format } from "date-fns";
import { SmilePlus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { addReaction, removeReaction, type Message } from "@/lib/queries/chat";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const QUICK_EMOJIS = ["👍", "🎉", "❤️", "😂", "👀"];

export function MessageItem({ message, channelId }: { message: Message; channelId: string }) {
  const [showPicker, setShowPicker] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const reactMutation = useMutation({
    mutationFn: ({ emoji, mine }: { emoji: string; mine: boolean }) =>
      mine ? removeReaction(message.id, emoji) : addReaction(message.id, emoji),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages", channelId] }),
  });

  const grouped = message.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/40">
      <Avatar className="mt-0.5 h-8 w-8 shrink-0">
        <AvatarImage src={message.author.avatarUrl ?? undefined} />
        <AvatarFallback className="text-xs">{message.author.name[0]}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{message.author.name}</span>
          <span className="text-xs text-muted-foreground">{format(new Date(message.createdAt), "h:mm a")}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm">{message.isDeleted ? <em className="text-muted-foreground">Message deleted</em> : message.content}</p>

        {!!Object.keys(grouped).length && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(grouped).map(([emoji, count]) => {
              const mine = message.reactions.some((r) => r.emoji === emoji && r.userId === currentUserId);
              return (
                <button
                  key={emoji}
                  onClick={() => reactMutation.mutate({ emoji, mine })}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs",
                    mine ? "border-primary bg-primary/10" : "border-border bg-muted/50",
                  )}
                >
                  {emoji} {count}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="relative opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={() => setShowPicker((v) => !v)} className="rounded p-1 text-muted-foreground hover:bg-accent">
          <SmilePlus className="h-4 w-4" />
        </button>
        {showPicker && (
          <div className="absolute right-0 top-7 z-10 flex gap-1 rounded-lg border border-border bg-popover p-1 shadow-soft-lg">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  reactMutation.mutate({ emoji, mine: false });
                  setShowPicker(false);
                }}
                className="rounded p-1 text-sm hover:bg-accent"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
