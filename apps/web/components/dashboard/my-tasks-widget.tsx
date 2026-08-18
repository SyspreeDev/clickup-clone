"use client";

import { format, isPast } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { PriorityIcon } from "@/components/task/priority-icon";
import { useTaskDetailStore } from "@/stores/task-detail-store";
import type { TaskSummary } from "@/lib/queries/tasks";
import { cn } from "@/lib/utils";

/** Overdue first, then soonest due date, then everything without a due date. */
function sortForAttention(tasks: TaskSummary[]) {
  return [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

export function MyTasksWidget({ tasks }: { tasks: TaskSummary[] }) {
  const openTask = useTaskDetailStore((s) => s.openTask);
  const open = sortForAttention(tasks.filter((t) => t.workflowState.category !== "COMPLETED" && t.workflowState.category !== "CANCELLED"));
  const visible = open.slice(0, 6);

  if (!visible.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <CheckCircle2 className="h-7 w-7 text-success" />
        <p className="text-sm font-medium">You&apos;re all caught up</p>
        <p className="text-xs text-muted-foreground">Nothing assigned to you is open right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {visible.map((task) => {
        const overdue = task.dueDate && isPast(new Date(task.dueDate));
        return (
          <div
            key={task.id}
            onClick={() => openTask(task.id)}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-sm transition-colors hover:border-border hover:bg-muted/40"
          >
            <PriorityIcon priority={task.priority} />
            <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
            {task.project && (
              <span className="hidden shrink-0 truncate text-xs text-muted-foreground sm:inline">{task.project.name}</span>
            )}
            {task.dueDate ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs",
                  overdue ? "bg-destructive/10 font-medium text-destructive" : "bg-muted text-muted-foreground",
                )}
              >
                {overdue ? "Overdue · " : ""}
                {format(new Date(task.dueDate), "MMM d")}
              </span>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground/60">No due date</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
