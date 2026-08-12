"use client";

import { PRIORITY_CONFIG } from "@/components/task/priority-icon";
import type { TaskSummary } from "@/lib/queries/tasks";
import { cn } from "@/lib/utils";

const ORDER: TaskSummary["priority"][] = ["URGENT", "HIGH", "MEDIUM", "LOW", "NO_PRIORITY"];

const BAR_COLOR: Record<TaskSummary["priority"], string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-blue-500",
  NO_PRIORITY: "bg-muted-foreground/40",
};

/** Breaks down a user's own open tasks by priority, so a glance shows how urgent the workload is. */
export function PriorityBreakdown({ tasks }: { tasks: TaskSummary[] }) {
  const open = tasks.filter((t) => t.workflowState.category !== "COMPLETED" && t.workflowState.category !== "CANCELLED");
  const total = open.length;

  if (!total) {
    return <p className="text-sm text-muted-foreground">Nothing open — you&apos;re all caught up.</p>;
  }

  const counts = ORDER.map((priority) => ({
    priority,
    count: open.filter((t) => t.priority === priority).length,
  })).filter((c) => c.count > 0);

  return (
    <div className="space-y-2.5">
      {counts.map(({ priority, count }) => (
        <div key={priority} className="flex items-center gap-2 text-sm">
          <span className="w-20 shrink-0 truncate text-muted-foreground">{PRIORITY_CONFIG[priority].label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", BAR_COLOR[priority])}
              style={{ width: `${Math.max((count / total) * 100, 6)}%` }}
            />
          </div>
          <span className="w-5 shrink-0 text-right font-medium tabular-nums">{count}</span>
        </div>
      ))}
    </div>
  );
}
