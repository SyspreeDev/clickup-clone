"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, Send, User as UserIcon, AlertTriangle, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AiMarkdown } from "@/components/ai/ai-markdown";
import { getAiStatus, streamAiChat, type AiMessageRecord } from "@/lib/queries/ai";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "How is the workspace doing overall?",
  "What's overdue right now?",
  "Give me a summary of the Web Team's lists.",
];

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  streaming?: boolean;
  error?: boolean;
}

let localId = 0;
const nextId = () => `local-${++localId}`;

function fromRecord(m: AiMessageRecord): LocalMessage {
  return { id: m.id, role: m.role === "USER" ? "user" : "assistant", content: m.content, toolsUsed: m.toolsUsed };
}

export function AiChatPanel({
  workspaceId,
  conversationId: initialConversationId,
  initialMessages,
  onConversationCreated,
}: {
  workspaceId: string;
  conversationId?: string;
  initialMessages?: AiMessageRecord[];
  onConversationCreated?: (conversationId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<LocalMessage[]>(() => initialMessages?.map(fromRecord) ?? []);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const conversationIdRef = useRef(initialConversationId);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["ai-status", workspaceId],
    queryFn: () => getAiStatus(workspaceId),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activeTool]);

  function send(message: string) {
    const text = message.trim();
    if (!text || isStreaming) return;
    setInput("");
    setIsStreaming(true);
    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: text }]);

    const assistantId = nextId();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", streaming: true }]);

    streamAiChat(workspaceId, { message: text, conversationId: conversationIdRef.current }, (event) => {
      switch (event.type) {
        case "conversation":
          // Track it for follow-up messages in this session, but don't navigate yet —
          // switching routes mid-stream would unmount this panel before "done" arrives.
          conversationIdRef.current = event.conversationId;
          break;
        case "delta":
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.text } : m)));
          break;
        case "tool":
          setActiveTool(event.name);
          break;
        case "done":
          setActiveTool(null);
          setIsStreaming(false);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: event.reply, toolsUsed: event.toolsUsed, streaming: false } : m)),
          );
          queryClient.invalidateQueries({ queryKey: ["ai-conversations", workspaceId] });
          onConversationCreated?.(event.conversationId);
          break;
        case "error":
          setActiveTool(null);
          setIsStreaming(false);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: event.message, streaming: false, error: true } : m)),
          );
          break;
      }
    }).catch((err) => {
      setActiveTool(null);
      setIsStreaming(false);
      const text = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: text, streaming: false, error: true } : m)));
    });
  }

  const notConfigured = status?.configured === false;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-4 scrollbar-thin">
        {statusLoading ? (
          <Skeleton className="h-24 w-full max-w-md" />
        ) : notConfigured ? (
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
              <p className="text-sm font-medium text-foreground">Ask about your work</p>
              <p className="text-xs text-muted-foreground">
                I can look up clients, tasks, and lists, and summarize progress across anything you have access to.
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
          messages.map((m) => (
            <div key={m.id} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  m.role === "user" ? "bg-secondary" : "bg-primary/10",
                )}
              >
                {m.role === "user" ? <UserIcon className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
              </div>
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-3 py-2",
                  m.role === "user"
                    ? "bg-primary text-sm text-primary-foreground"
                    : m.error
                      ? "bg-destructive/10 text-sm text-destructive"
                      : "bg-muted text-foreground",
                )}
              >
                {m.role === "user" || m.error ? (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                ) : (
                  <AiMarkdown content={m.content || " "} />
                )}
                {m.streaming && m.content === "" && !activeTool && (
                  <span className="inline-flex gap-1 py-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
                  </span>
                )}
                {m.streaming && m.content !== "" && (
                  <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-current/40 align-middle" />
                )}
              </div>
            </div>
          ))
        )}

        {activeTool && (
          <div className="flex items-center gap-2.5 pl-9 text-xs text-muted-foreground">
            <Wrench className="h-3 w-3 animate-pulse" />
            <span>{toolLabel(activeTool)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={notConfigured ? "AI assistant not configured" : "Ask about your work…"}
            disabled={isStreaming || notConfigured}
            className="max-h-32 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isStreaming || notConfigured}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function toolLabel(name: string): string {
  switch (name) {
    case "search_workspace":
      return "Searching your workspace…";
    case "get_task_details":
      return "Pulling up task details…";
    case "get_project_stats":
      return "Crunching project stats…";
    case "search_overdue_tasks":
      return "Checking overdue tasks…";
    default:
      return `Using ${name}…`;
  }
}
