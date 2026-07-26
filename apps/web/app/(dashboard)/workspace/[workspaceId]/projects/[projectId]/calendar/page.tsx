"use client";

import { use, useMemo } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { TopNav } from "@/components/layout/top-nav";
import { TaskDetailDialog } from "@/components/task/task-detail-dialog";
import { useTaskDetailStore } from "@/stores/task-detail-store";
import { useProjectTasks } from "@/hooks/use-project-tasks";
import { Skeleton } from "@/components/ui/skeleton";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: enUS }),
  getDay,
  locales,
});

export default function CalendarViewPage({ params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
  const { projectId } = use(params);
  const { data: tasks, isLoading } = useProjectTasks(projectId);
  const openTask = useTaskDetailStore((s) => s.openTask);

  const events = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.dueDate)
        .map((t) => ({
          id: t.id,
          title: t.title,
          start: new Date(t.startDate ?? t.dueDate!),
          end: new Date(t.dueDate!),
          allDay: true,
          resource: t,
        })),
    [tasks],
  );

  if (isLoading) {
    return (
      <>
        <TopNav />
        <div className="p-4">
          <Skeleton className="h-[600px] w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <div className="flex-1 overflow-y-auto p-4 [--rbc-today:hsl(var(--accent))] flowspace-calendar">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          views={["month", "week", "day"] as View[]}
          defaultView="month"
          style={{ height: 700 }}
          onSelectEvent={(event) => openTask(event.id)}
          eventPropGetter={(event) => {
            const priority = (event.resource as { priority: string }).priority;
            const color =
              priority === "URGENT" ? "#ef4444" : priority === "HIGH" ? "#f97316" : priority === "MEDIUM" ? "#f59e0b" : "#6366f1";
            return { style: { backgroundColor: color, border: "none", borderRadius: 6, fontSize: 12 } };
          }}
        />
      </div>
      <TaskDetailDialog />
    </>
  );
}
