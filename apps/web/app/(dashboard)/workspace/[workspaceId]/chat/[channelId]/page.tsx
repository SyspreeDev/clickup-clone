"use client";

import { use, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageItem } from "@/components/chat/message-item";
import { Skeleton } from "@/components/ui/skeleton";
import { listMessages, sendMessage } from "@/lib/queries/chat";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth-store";

export default function ChannelPage({ params }: { params: Promise<{ workspaceId: string; channelId: string }> }) {
  const { channelId } = use(params);
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", channelId],
    queryFn: () => listMessages(channelId),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  // The API broadcasts new messages to this channel's own socket room (rather than
  // the whole workspace, unlike tasks/activity) — so whoever has it open needs to
  // actually be in that room, or the live update never arrives.
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    const join = () => socket.emit("join:channel", channelId);
    if (socket.connected) join();
    socket.on("connect", join);
    return () => {
      socket.emit("leave:channel", channelId);
      socket.off("connect", join);
    };
  }, [accessToken, channelId]);

  const mutation = useMutation({
    mutationFn: () => sendMessage(channelId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
      setContent("");
    },
  });

  function submit() {
    if (!content.trim()) return;
    mutation.mutate();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}
        {!isLoading && !messages?.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello 👋</p>
        )}
        {messages?.map((message) => (
          <MessageItem key={message.id} message={message} channelId={channelId} />
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Message…"
          rows={1}
          className="flex-1 resize-none rounded-lg border border-input bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <Button size="icon" onClick={submit} disabled={!content.trim() || mutation.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
