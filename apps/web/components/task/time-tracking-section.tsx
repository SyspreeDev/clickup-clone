"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Clock, Pause, Play, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createTimeEntry, deleteTimeEntry, stopTimeEntry } from "@/lib/queries/tasks";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api-client";
import type { TaskDetail, TimeEntry } from "@/lib/queries/tasks";

/** "1h 45m", "45m", "0m" — the compact form used across the reports screens. */
export function formatMinutes(total: number): string {
  const mins = Math.max(0, Math.round(total));
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (!hours) return `${rest}m`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

/**
 * Accepts what people actually type into a time box: "90", "1.5h", "1h30",
 * "1h 30m", "45m", "2:15". Returns minutes, or null when it can't tell.
 */
export function parseDuration(raw: string): number | null {
  const input = raw.trim().toLowerCase();
  if (!input) return null;

  const clock = input.match(/^(\d+):([0-5]?\d)$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  const hm = input.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(\d+(?:\.\d+)?)?\s*m?(?:ins?|inutes?)?$/);
  if (hm) return Math.round(Number(hm[1]) * 60 + Number(hm[2] ?? 0));

  const mOnly = input.match(/^(\d+(?:\.\d+)?)\s*m(?:ins?|inutes?)$/);
  if (mOnly) return Math.round(Number(mOnly[1]));

  // A bare number means minutes, matching the estimate field in the sidebar.
  const bare = input.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return Math.round(Number(bare[1]));

  return null;
}

/** Live minutes for a running entry, ticking so the figure doesn't look frozen. */
function useRunningMinutes(startedAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000));
}

function EntryRow({ entry, onDelete, deleting }: { entry: TimeEntry; onDelete: () => void; deleting: boolean }) {
  const running = !entry.endedAt;
  const live = useRunningMinutes(running ? entry.startedAt : undefined);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-sm">
      <Avatar className="h-5 w-5 shrink-0">
        <AvatarImage src={entry.user.avatarUrl ?? undefined} />
        <AvatarFallback className="text-[9px]">{entry.user.name[0]}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs">
          <span className="font-medium">{entry.user.name}</span>
          {entry.description && <span className="text-muted-foreground"> · {entry.description}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{format(new Date(entry.startedAt), "d MMM yy, HH:mm")}</p>
      </div>
      <span className={cn("shrink-0 text-xs font-medium tabular-nums", running && "text-primary")}>
        {running ? `${formatMinutes(live)}…` : formatMinutes(entry.durationMinutes ?? 0)}
      </span>
      <button
        onClick={onDelete}
        disabled={deleting}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
        title="Delete entry"
        aria-label={`Delete time entry by ${entry.user.name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Time logged against one task. The timer is a server-side entry with no end time
 * rather than a countdown held in the tab, so it keeps running across a reload and
 * is visible to whoever else opens the task.
 */
export function TimeTrackingSection({ task, onChange }: { task: TaskDetail; onChange: () => void }) {
  const userId = useAuthStore((s) => s.user)?.id;
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const entries = task.timeEntries;
  const myRunning = entries.find((e) => !e.endedAt && e.user.id === userId);
  const liveMinutes = useRunningMinutes(myRunning?.startedAt);

  const loggedMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
  const estimate = task.estimateMinutes ?? 0;
  // The running timer counts toward the bar so progress doesn't jump on stop.
  const totalMinutes = loggedMinutes + (myRunning ? liveMinutes : 0);
  const overEstimate = estimate > 0 && totalMinutes > estimate;

  const fail = (fallback: string) => (err: unknown) =>
    toast.error(err instanceof ApiError ? err.message : fallback);

  const start = useMutation({
    mutationFn: () => createTimeEntry(task.id, { startedAt: new Date() }),
    onSuccess: onChange,
    onError: fail("Could not start the timer"),
  });

  const stop = useMutation({
    mutationFn: (id: string) => stopTimeEntry(id),
    onSuccess: (entry) => {
      onChange();
      toast.success(`Logged ${formatMinutes(entry.durationMinutes ?? 0)}`);
    },
    onError: fail("Could not stop the timer"),
  });

  const logManual = useMutation({
    mutationFn: (minutes: number) => {
      const endedAt = new Date();
      return createTimeEntry(task.id, {
        // Back-date the start so the entry reads as the block of work it describes.
        startedAt: new Date(endedAt.getTime() - minutes * 60_000),
        endedAt,
        durationMinutes: minutes,
        description: note.trim() || undefined,
        isManual: true,
      });
    },
    onSuccess: () => {
      setAmount("");
      setNote("");
      setAdding(false);
      onChange();
      toast.success("Time logged");
    },
    onError: fail("Could not log that time"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTimeEntry(id),
    onSuccess: onChange,
    onError: fail("Could not delete that entry"),
  });

  const parsed = parseDuration(amount);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          Time tracked
        </div>
        <div className="flex items-center gap-1">
          {myRunning ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 gap-1 px-2 text-xs"
              disabled={stop.isPending}
              onClick={() => stop.mutate(myRunning.id)}
            >
              <Pause className="h-3 w-3" />
              Stop · {formatMinutes(liveMinutes)}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 gap-1 px-2 text-xs"
              disabled={start.isPending}
              onClick={() => start.mutate()}
            >
              <Play className="h-3 w-3" />
              Start timer
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={() => setAdding((v) => !v)}
          >
            <Plus className="h-3 w-3" />
            Log time
          </Button>
        </div>
      </div>

      <div className="mb-2 flex items-baseline gap-1.5 text-xs text-muted-foreground">
        <span className={cn("text-sm font-semibold text-foreground", overEstimate && "text-destructive")}>
          {formatMinutes(totalMinutes)}
        </span>
        {estimate > 0 ? <span>of {formatMinutes(estimate)} estimated</span> : <span>logged · no estimate set</span>}
      </div>

      {estimate > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
          <div
            className={cn("h-full rounded-full transition-all", overEstimate ? "bg-destructive" : "bg-primary")}
            style={{ width: `${Math.min(100, (totalMinutes / estimate) * 100)}%` }}
          />
        </div>
      )}

      {adding && (
        <div className="mb-2 flex items-center gap-1.5">
          <Input
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1h 30m"
            className="h-8 w-24"
            aria-label="Time to log"
            onKeyDown={(e) => {
              if (e.key === "Enter" && parsed) logManual.mutate(parsed);
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you work on? (optional)"
            className="h-8 flex-1"
            aria-label="Note"
            onKeyDown={(e) => {
              if (e.key === "Enter" && parsed) logManual.mutate(parsed);
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <Button
            size="sm"
            className="h-8"
            disabled={!parsed || logManual.isPending}
            onClick={() => parsed && logManual.mutate(parsed)}
          >
            Add
          </Button>
        </div>
      )}
      {adding && amount.trim() && !parsed && (
        <p className="mb-2 text-xs text-destructive">Try a value like 90, 1.5h, 1h 30m, or 2:15.</p>
      )}

      <div className="space-y-1">
        {entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            deleting={remove.isPending}
            onDelete={() => remove.mutate(entry.id)}
          />
        ))}
        {!entries.length && !adding && (
          <p className="text-xs text-muted-foreground">Nothing logged yet — start the timer or log time by hand.</p>
        )}
      </div>
    </section>
  );
}
