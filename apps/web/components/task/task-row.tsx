"use client";

import { format, isPast } from "date-fns";
import { Calendar, MessageSquare, CheckSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PriorityIcon } from "@/components/task/priority-icon";
import { useTaskDetailStore } from "@/stores/task-detail-store";
import { cn } from "@/lib/utils";
import type { TaskSummary } from "@/lib/queries/tasks";

export function TaskRow({ task, projectKey }: { task: TaskSummary; projectKey: string }) {
  const openTask = useTaskDetailStore((s) => s.openTask);
  const overdue = task.dueDate && isPast(new Date(task.dueDate)) && task.workflowState.category !== "COMPLETED";

  return (
    <div
      onClick={() => openTask(task.id)}
      className="flex cursor-pointer items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm transition-colors hover:bg-accent/50"
    >
      <PriorityIcon priority={task.priority} />
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
        {projectKey}-{task.number}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>

      {!!task.taskLabels.length && (
        <div className="hidden shrink-0 gap-1 sm:flex">
          {task.taskLabels.slice(0, 2).map(({ label }) => (
            <span
              key={label.id}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${label.color}22`, color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        {task._count.checklists > 0 && <CheckSquare className="h-3.5 w-3.5" />}
        {task._count.comments > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {task._count.comments}
          </span>
        )}
        {task.dueDate && (
          <span className={cn("flex items-center gap-1", overdue && "font-medium text-destructive")}>
            <Calendar className="h-3.5 w-3.5" />
            {format(new Date(task.dueDate), "MMM d")}
          </span>
        )}
      </div>

      <div className="flex w-16 shrink-0 justify-end">
        {task.assignees.slice(0, 1).map((a) => (
          <Avatar key={a.id} className="h-6 w-6">
            <AvatarImage src={a.user.avatarUrl ?? undefined} />
            <AvatarFallback className="text-[10px]">{a.user.name[0]}</AvatarFallback>
          </Avatar>
        ))}
      </div>
    </div>
  );
}
