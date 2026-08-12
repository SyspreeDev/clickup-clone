"use client";

import { Search, X, User } from "lucide-react";
import { PRIORITY_CONFIG } from "@/components/task/priority-icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { TaskSummary } from "@/lib/queries/tasks";

export interface TaskFilters {
  query: string;
  priority: TaskSummary["priority"] | "ALL";
  onlyMine: boolean;
}

export const DEFAULT_TASK_FILTERS: TaskFilters = { query: "", priority: "ALL", onlyMine: false };

const PRIORITY_ORDER: TaskSummary["priority"][] = ["URGENT", "HIGH", "MEDIUM", "LOW", "NO_PRIORITY"];

export function hasActiveFilters(filters: TaskFilters) {
  return filters.query.trim() !== "" || filters.priority !== "ALL" || filters.onlyMine;
}

/** Client-side filtering — every view here already loads the full task list, so this just narrows what's rendered. */
export function filterTasks(tasks: TaskSummary[], filters: TaskFilters, currentUserId?: string) {
  if (!hasActiveFilters(filters)) return tasks;
  const q = filters.query.trim().toLowerCase();
  return tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q)) return false;
    if (filters.priority !== "ALL" && t.priority !== filters.priority) return false;
    if (filters.onlyMine && !t.assignees.some((a) => a.userId === currentUserId)) return false;
    return true;
  });
}

/**
 * Search + priority + "assigned to me" bar shared by List/Table/Board. Matters most
 * on lists imported from elsewhere that can run into the hundreds of tasks with no
 * other way to narrow them down.
 */
export function TaskFilterBar({
  filters,
  onChange,
  totalCount,
  filteredCount,
}: {
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
  totalCount: number;
  filteredCount: number;
}) {
  const active = hasActiveFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
      <div className="relative w-full max-w-xs sm:w-56">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Search this list…"
          className="h-8 pl-8 text-sm"
        />
      </div>

      <select
        value={filters.priority}
        onChange={(e) => onChange({ ...filters, priority: e.target.value as TaskFilters["priority"] })}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        aria-label="Filter by priority"
      >
        <option value="ALL">Any priority</option>
        {PRIORITY_ORDER.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_CONFIG[p].label}
          </option>
        ))}
      </select>

      <Button
        type="button"
        size="sm"
        variant={filters.onlyMine ? "default" : "secondary"}
        className="h-8 gap-1.5"
        onClick={() => onChange({ ...filters, onlyMine: !filters.onlyMine })}
      >
        <User className="h-3.5 w-3.5" />
        Assigned to me
      </Button>

      {active && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1 text-muted-foreground"
          onClick={() => onChange(DEFAULT_TASK_FILTERS)}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}

      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
        {active ? `${filteredCount} of ${totalCount}` : totalCount} {totalCount === 1 ? "task" : "tasks"}
      </span>
    </div>
  );
}
