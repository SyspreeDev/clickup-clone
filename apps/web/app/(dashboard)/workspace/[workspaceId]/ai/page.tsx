"use client";

import { use, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles, Send, User as UserIcon, AlertTriangle } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAiStatus, sendAiChat, type AiChatMessage } from "@/lib/queries/ai";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "How is the workspace doing overall?",
  "What's overdue right now?",
  "Give me a summary of the Web Team's lists.",
];

export default function AiPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["ai-status", workspaceId],
    queryFn: () => getAiStatus(workspaceId),
  });

  const mutation = useMutation({
    mutationFn: (message: string) => sendAiChat(workspaceId, message, messages),
    onSuccess: (result, message) => {
      setMessages((prev) => [...prev, { role: "user", content: message }, { role: "assistant", content: result.reply }]);
    },
    onError: (err, message) => {
      const text = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [...prev, { role: "user", content: message }, { role: "assistant", content: `⚠️ ${text}` }]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mutation.isPending]);

  function send(message: string) {
    const text = message.trim();
    if (!text || mutation.isPending) return;
    setInput("");
    mutation.mutate(text);
  }

  return (
    <div className="flex h-full flex-col">
      <TopNav title="AI Assistant" />

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
        {statusLoading ? (
          <Skeleton className="h-24 w-full max-w-md" />
        ) : status && !status.configured ? (
          <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <p className="text-sm font-medium text-foreground">AI assistant not configured</p>
            <p className="text-xs text-muted-foreground">Ask an admin to add an Anthropic API key to enable this feature.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Ask about your projects</p>
              <p className="text-xs text-muted-foreground">
                I can look up task stats and overdue work across everything you have access to.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              {QUICK_PROMPTS.map((p) => (
                <Button key={p} variant="outline" size="sm" onClick={() => send(p)}>
                  {p}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  m.role === "user" ? "bg-secondary" : "bg-primary/10",
                )}
              >
                {m.role === "user" ? (
                  <UserIcon className="h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[75%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                {m.content}
              </div>
            </div>
          ))
        )}

        {mutation.isPending && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
            </div>
            <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Thinking…</div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={status?.configured === false ? "AI assistant not configured" : `Ask about ${user?.name ? "your work" : "the workspace"}…`}
            disabled={mutation.isPending || status?.configured === false}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || mutation.isPending || status?.configured === false}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
