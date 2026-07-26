"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast } from "date-fns";
import { MessageSquare, Paperclip, CheckSquare, Calendar } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PriorityIcon } from "@/components/task/priority-icon";
import { useTaskDetailStore } from "@/stores/task-detail-store";
import { cn } from "@/lib/utils";
import type { TaskSummary } from "@/lib/queries/tasks";

export function TaskCard({ task, projectKey }: { task: TaskSummary; projectKey: string }) {
  const openTask = useTaskDetailStore((s) => s.openTask);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const overdue = task.dueDate && isPast(new Date(task.dueDate)) && task.workflowState.category !== "COMPLETED";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => openTask(task.id)}
      className={cn(
        "cursor-pointer space-y-2 rounded-xl border border-border bg-card p-3 shadow-soft transition-shadow hover:shadow-soft-lg",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {projectKey}-{task.number}
        </span>
        <PriorityIcon priority={task.priority} />
      </div>
      <p className="text-sm font-medium leading-snug">{task.title}</p>

      {!!task.taskLabels.length && (
        <div className="flex flex-wrap gap-1">
          {task.taskLabels.map(({ label }) => (
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

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
          {task.dueDate && (
            <span className={cn("flex items-center gap-1", overdue && "font-medium text-destructive")}>
              <Calendar className="h-3 w-3" />
              {format(new Date(task.dueDate), "MMM d")}
            </span>
          )}
          {task._count.checklists > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
            </span>
          )}
          {task._count.comments > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {task._count.comments}
            </span>
          )}
          {task._count.attachments > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              {task._count.attachments}
            </span>
          )}
        </div>
        {!!task.assignees.length && (
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 3).map((a) => (
              <Avatar key={a.id} className="h-5 w-5 border-2 border-card">
                <AvatarImage src={a.user.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[9px]">{a.user.name[0]}</AvatarFallback>
              </Avatar>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
