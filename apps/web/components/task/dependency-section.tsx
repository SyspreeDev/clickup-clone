"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, GitBranch, Link2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDependency, listTasks, removeDependency } from "@/lib/queries/tasks";
import { useTaskDetailStore } from "@/stores/task-detail-store";
import { ApiError } from "@/lib/api-client";
import type { LinkedTask, TaskDetail, TaskSummary } from "@/lib/queries/tasks";

/**
 * The three relations, in the direction a person reads them off this task.
 *
 * A dependency row is stored as (task → dependsOn) meaning "task waits for
 * dependsOn". So on this task's screen:
 *  - "Blocked by" is this task's own `dependencies` — the work that must land first.
 *  - "Blocking" is its `dependents` — rows other tasks own, pointing back here.
 * Recording "this blocks X" therefore means creating the row on X, which is why
 * `owner` below decides which task id the POST goes to.
 */
const GROUPS = [
  {
    key: "blockedBy" as const,
    label: "Blocked by",
    icon: Ban,
    owner: "self" as const,
    type: "BLOCKS" as const,
    hint: "Work that has to finish before this can move",
  },
  {
    key: "blocking" as const,
    label: "Blocking",
    icon: GitBranch,
    owner: "other" as const,
    type: "BLOCKS" as const,
    hint: "Work that is waiting on this",
  },
  {
    key: "relatedTo" as const,
    label: "Related",
    icon: Link2,
    owner: "self" as const,
    type: "RELATES_TO" as const,
    hint: "Connected work, with no ordering implied",
  },
];

type Row = { id: string; task: LinkedTask };

function isDone(task: LinkedTask) {
  return task.workflowState?.category === "COMPLETED";
}

function LinkedRow({ row, onRemove, removing }: { row: Row; onRemove: () => void; removing: boolean }) {
  // Clicking a linked task swaps the dialog over to it rather than opening a second one.
  const openTask = useTaskDetailStore((s) => s.openTask);
  const done = isDone(row.task);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-sm">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: row.task.workflowState?.color ?? "hsl(var(--muted-foreground))" }}
        title={row.task.workflowState?.name}
      />
      <button
        onClick={() => openTask(row.task.id)}
        className={cn("min-w-0 flex-1 truncate text-left hover:underline", done && "text-muted-foreground line-through")}
        title={row.task.title}
      >
        {row.task.title}
      </button>
      <span className="shrink-0 text-xs text-muted-foreground">{row.task.workflowState?.name}</span>
      <button
        onClick={onRemove}
        disabled={removing}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
        title="Unlink"
        aria-label={`Unlink ${row.task.title}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AddLink({
  task,
  group,
  onDone,
}: {
  task: TaskDetail;
  group: (typeof GROUPS)[number];
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  // Candidates come from this list. Cross-list links are allowed by the API, but a
  // picker over the whole workspace would be a search feature of its own.
  const { data: candidates } = useQuery({
    queryKey: ["tasks", task.projectId],
    queryFn: () => listTasks(task.projectId),
    enabled: open,
  });

  const alreadyLinked = useMemo(
    () =>
      new Set([
        task.id,
        ...task.dependencies.map((d) => d.dependsOn.id),
        ...task.dependents.map((d) => d.task.id),
      ]),
    [task],
  );

  const matches = (candidates ?? [])
    .filter((t) => !alreadyLinked.has(t.id))
    .filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8);

  const link = useMutation({
    mutationFn: (other: TaskSummary) =>
      group.owner === "self"
        ? addDependency(task.id, { dependsOnId: other.id, type: group.type })
        : addDependency(other.id, { dependsOnId: task.id, type: group.type }),
    onSuccess: () => {
      setQuery("");
      setOpen(false);
      onDone();
      toast.success("Tasks linked");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not link those tasks"),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground">
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <p className="px-1 pb-1.5 text-xs text-muted-foreground">{group.hint}</p>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this list…"
          className="h-8"
        />
        <div className="mt-1.5 max-h-56 space-y-0.5 overflow-y-auto scrollbar-thin">
          {matches.map((t) => (
            <button
              key={t.id}
              disabled={link.isPending}
              onClick={() => link.mutate(t)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: t.workflowState.color }}
              />
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
            </button>
          ))}
          {!matches.length && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {candidates ? "Nothing else in this list to link" : "Loading…"}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Shows what this task waits on and what waits on it. Both directions live on the
 * one task record already, so no extra fetch is needed to render them.
 */
export function DependencySection({ task, onChange }: { task: TaskDetail; onChange: () => void }) {
  const unlink = useMutation({
    mutationFn: (id: string) => removeDependency(id),
    onSuccess: () => {
      onChange();
      toast.success("Link removed");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not remove the link"),
  });

  const rows: Record<(typeof GROUPS)[number]["key"], Row[]> = {
    blockedBy: task.dependencies.filter((d) => d.type === "BLOCKS").map((d) => ({ id: d.id, task: d.dependsOn })),
    blocking: task.dependents.filter((d) => d.type === "BLOCKS").map((d) => ({ id: d.id, task: d.task })),
    relatedTo: [
      ...task.dependencies.filter((d) => d.type !== "BLOCKS").map((d) => ({ id: d.id, task: d.dependsOn })),
      ...task.dependents.filter((d) => d.type !== "BLOCKS").map((d) => ({ id: d.id, task: d.task })),
    ],
  };

  const openBlockers = rows.blockedBy.filter((r) => !isDone(r.task));

  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
        Dependencies
      </div>

      {openBlockers.length > 0 && (
        <p className="mb-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          Waiting on {openBlockers.length} unfinished {openBlockers.length === 1 ? "task" : "tasks"}.
        </p>
      )}

      <div className="space-y-3">
        {GROUPS.map((group) => {
          const groupRows = rows[group.key];
          // Keep the panel quiet: an empty relation only appears once you add to it,
          // while "Blocked by" and "Blocking" always offer their add button.
          if (!groupRows.length && group.key === "relatedTo") {
            return (
              <div key={group.key} className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
                <AddLink task={task} group={group} onDone={onChange} />
              </div>
            );
          }
          return (
            <div key={group.key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <group.icon className="h-3 w-3" />
                  {group.label}
                  {groupRows.length > 0 && <span className="font-normal">{groupRows.length}</span>}
                </span>
                <AddLink task={task} group={group} onDone={onChange} />
              </div>
              <div className="space-y-1">
                {groupRows.map((row) => (
                  <LinkedRow
                    key={row.id}
                    row={row}
                    removing={unlink.isPending}
                    onRemove={() => unlink.mutate(row.id)}
                  />
                ))}
                {!groupRows.length && <p className="px-0.5 text-xs text-muted-foreground">{group.hint}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
