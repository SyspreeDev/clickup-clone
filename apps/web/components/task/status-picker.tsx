"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { moveTask } from "@/lib/queries/tasks";
import { ApiError } from "@/lib/api-client";
import type { WorkflowState } from "@/lib/queries/projects";

/** COMPLETED and CANCELLED states are the "Closed" group, matching ClickUp. */
export function isClosedCategory(category: WorkflowState["category"]) {
  return category === "COMPLETED" || category === "CANCELLED";
}

function StatusDot({ color, closed }: { color: string; closed?: boolean }) {
  return closed ? (
    <span
      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: color }}
    >
      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
    </span>
  ) : (
    <CircleDashed className="h-3.5 w-3.5 shrink-0" style={{ color }} />
  );
}

/** The coloured status pill shown in a task row / detail header. */
export function StatusBadge({ state, className }: { state: WorkflowState | undefined; className?: string }) {
  if (!state) return <span className="text-xs text-muted-foreground">No status</span>;
  return (
    <span
      className={cn(
        "inline-flex max-w-[190px] items-center gap-1.5 truncate rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide",
        className,
      )}
      style={{ backgroundColor: `${state.color}22`, color: state.color }}
    >
      <StatusDot color={state.color} closed={isClosedCategory(state.category)} />
      <span className="truncate">{state.name}</span>
    </span>
  );
}

/**
 * ClickUp-style status dropdown: this list's own statuses, split into open
 * "Statuses" and "Closed", searchable, with a tick on the current one.
 */
export function StatusPicker({
  taskId,
  projectId,
  states,
  currentStateId,
  currentPosition,
  align = "start",
}: {
  taskId: string;
  projectId: string;
  states: WorkflowState[] | undefined;
  currentStateId: string | null;
  /** Kept as-is: changing status shouldn't reshuffle the task within its group. */
  currentPosition: number;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const queryClient = useQueryClient();

  const ordered = useMemo(
    () => [...(states ?? [])].sort((a, b) => a.position - b.position),
    [states],
  );
  const current = ordered.find((s) => s.id === currentStateId);

  const matches = (s: WorkflowState) => s.name.toLowerCase().includes(query.trim().toLowerCase());
  const openStates = ordered.filter((s) => !isClosedCategory(s.category)).filter(matches);
  const closedStates = ordered.filter((s) => isClosedCategory(s.category)).filter(matches);

  // moveTask rather than updateTask: it owns completedAt, the activity log and
  // the "task completed" notifications.
  const mutation = useMutation({
    mutationFn: (workflowStateId: string) =>
      moveTask(taskId, { workflowStateId, position: currentPosition }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["workflow-states", projectId] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      setOpen(false);
      setQuery("");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not update status"),
  });

  function Row({ state }: { state: WorkflowState }) {
    const selected = state.id === currentStateId;
    return (
      <button
        onClick={() => !selected && mutation.mutate(state.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide transition-colors",
          selected ? "bg-muted" : "hover:bg-muted/70",
        )}
        style={{ color: state.color }}
      >
        <StatusDot color={state.color} closed={isClosedCategory(state.category)} />
        <span className="truncate">{state.name}</span>
        {selected && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
      </button>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger
        className="inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        disabled={mutation.isPending || ordered.length === 0}
        aria-label="Change status"
      >
        <StatusBadge state={current} />
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent align={align} className="w-64 p-2">
        <Input
          autoFocus
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-2 h-8"
        />

        <div className="max-h-72 space-y-2 overflow-y-auto scrollbar-thin">
          {openStates.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[11px] font-medium text-muted-foreground">Statuses</p>
              {openStates.map((s) => (
                <Row key={s.id} state={s} />
              ))}
            </div>
          )}

          {closedStates.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[11px] font-medium text-muted-foreground">Closed</p>
              {closedStates.map((s) => (
                <Row key={s.id} state={s} />
              ))}
            </div>
          )}

          {openStates.length === 0 && closedStates.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No statuses match.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
