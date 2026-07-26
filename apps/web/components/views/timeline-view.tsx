"use client";

import { useMemo } from "react";
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import { PriorityIcon } from "@/components/task/priority-icon";
import { useTaskDetailStore } from "@/stores/task-detail-store";
import { cn } from "@/lib/utils";
import type { TaskSummary } from "@/lib/queries/tasks";

const DAY_WIDTH = 36;
const ROW_HEIGHT = 44;

export function TimelineView({ tasks, projectKey }: { tasks: TaskSummary[]; projectKey: string }) {
  const openTask = useTaskDetailStore((s) => s.openTask);

  const scheduled = tasks.filter((t) => t.dueDate);

  const { rangeStart, days } = useMemo(() => {
    const dates = scheduled.flatMap((t) => [t.startDate ? new Date(t.startDate) : new Date(t.dueDate!), new Date(t.dueDate!)]);
    const today = startOfDay(new Date());
    const min = dates.length ? startOfDay(new Date(Math.min(...dates.map((d) => d.getTime()), today.getTime()))) : today;
    const max = dates.length ? startOfDay(new Date(Math.max(...dates.map((d) => d.getTime()), today.getTime()))) : addDays(today, 14);
    const totalDays = Math.max(differenceInCalendarDays(max, min) + 7, 14);
    return { rangeStart: min, days: Array.from({ length: totalDays }, (_, i) => addDays(min, i)) };
  }, [scheduled]);

  if (!scheduled.length) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No tasks with due dates yet — set a due date to see it on the timeline.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto scrollbar-thin">
      <div style={{ width: days.length * DAY_WIDTH + 240, minWidth: "100%" }}>
        <div className="sticky top-0 z-10 flex border-b border-border bg-background">
          <div className="w-60 shrink-0 border-r border-border px-3 py-2 text-xs font-medium text-muted-foreground">Task</div>
          {days.map((day) => (
            <div
              key={day.toISOString()}
              style={{ width: DAY_WIDTH }}
              className={cn(
                "shrink-0 border-r border-border/50 py-2 text-center text-[10px] text-muted-foreground",
                day.getDay() === 0 || day.getDay() === 6 ? "bg-muted/30" : "",
              )}
            >
              {format(day, "MMM d")}
            </div>
          ))}
        </div>

        {scheduled.map((task) => {
          const start = task.startDate ? startOfDay(new Date(task.startDate)) : startOfDay(new Date(task.dueDate!));
          const end = startOfDay(new Date(task.dueDate!));
          const offsetDays = Math.max(differenceInCalendarDays(start, rangeStart), 0);
          const spanDays = Math.max(differenceInCalendarDays(end, start) + 1, 1);
          const color =
            task.priority === "URGENT" ? "#ef4444" : task.priority === "HIGH" ? "#f97316" : task.priority === "MEDIUM" ? "#f59e0b" : "#6366f1";

          return (
            <div key={task.id} className="flex border-b border-border/60" style={{ height: ROW_HEIGHT }}>
              <div className="flex w-60 shrink-0 items-center gap-1.5 border-r border-border px-3">
                <PriorityIcon priority={task.priority} />
                <span className="truncate text-xs font-medium text-muted-foreground">{projectKey}-{task.number}</span>
              </div>
              <div className="relative flex-1" style={{ width: days.length * DAY_WIDTH }}>
                <button
                  onClick={() => openTask(task.id)}
                  style={{
                    position: "absolute",
                    left: offsetDays * DAY_WIDTH + 4,
                    top: 8,
                    width: spanDays * DAY_WIDTH - 8,
                    backgroundColor: `${color}22`,
                    borderColor: color,
                  }}
                  className="h-7 truncate rounded-md border px-2 text-left text-xs font-medium"
                  title={task.title}
                >
                  <span style={{ color }}>{task.title}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
