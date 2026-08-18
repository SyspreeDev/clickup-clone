"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Building2 } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { TaskDetailDialog } from "@/components/task/task-detail-dialog";
import { PriorityIcon } from "@/components/task/priority-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaskDetailStore } from "@/stores/task-detail-store";
import { getAllTasks, type WorkspaceTaskItem } from "@/lib/queries/workspaces";
import { DEFAULT_TASK_FILTERS, TaskFilterBar, filterTasks } from "@/components/views/task-filter-bar";
import { useAuthStore } from "@/stores/auth-store";

type StatusBucket = "ALL" | "OPEN" | "CLOSED";

/**
 * Every task in every space/list in the workspace, in one table — deliberately not
 * scoped to the viewer's own teams. "Client" here means what it means everywhere
 * else in Teamspree: a task inside a delivery list, not a distinct data model.
 */
export default function ClientsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["all-tasks", workspaceId],
    queryFn: () => getAllTasks(workspaceId),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const openTask = useTaskDetailStore((s) => s.openTask);
  const userId = useAuthStore((s) => s.user?.id);
  const [filters, setFilters] = useState(DEFAULT_TASK_FILTERS);
  const [spaceId, setSpaceId] = useState("ALL");
  const [statusBucket, setStatusBucket] = useState<StatusBucket>("ALL");

  const allTasks = tasks ?? [];

  const spaces = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of allTasks) {
      if (t.project.team) map.set(t.project.team.id, t.project.team.name);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allTasks]);

  let visible = filterTasks(allTasks, filters, userId) as WorkspaceTaskItem[];
  if (spaceId !== "ALL") visible = visible.filter((t) => t.project.team?.id === spaceId);
  if (statusBucket !== "ALL") {
    visible = visible.filter((t) =>
      statusBucket === "CLOSED" ? t.workflowState.category === "COMPLETED" : t.workflowState.category !== "COMPLETED",
    );
  }

  if (isLoading) {
    return (
      <>
        <TopNav title="Clients" />
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <TopNav title="Clients" />
      <TaskFilterBar filters={filters} onChange={setFilters} totalCount={allTasks.length} filteredCount={visible.length} />
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <select
          value={spaceId}
          onChange={(e) => setSpaceId(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          aria-label="Filter by space"
        >
          <option value="ALL">All spaces</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={statusBucket}
          onChange={(e) => setStatusBucket(e.target.value as StatusBucket)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          aria-label="Filter by pipeline stage"
        >
          <option value="ALL">Open &amp; closed</option>
          <option value="OPEN">Open only</option>
          <option value="CLOSED">Closed only</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        {!allTasks.length && (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
            <Building2 className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">Nothing here yet</p>
            <p className="text-sm text-muted-foreground">Every task across every space in this workspace shows up here.</p>
          </div>
        )}
        {!!allTasks.length && !visible.length && (
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing matches these filters.</p>
        )}
        {!!visible.length && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-2">Space</th>
                <th className="px-4 py-2">List</th>
                <th className="px-4 py-2">Client / Task</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Assignee</th>
                <th className="px-4 py-2">Due date</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => openTask(task.id)}
                  className="cursor-pointer border-b border-border/60 transition-colors hover:bg-accent/50"
                >
                  <td className="px-4 py-2.5">
                    {task.project.team ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: task.project.team.color ?? "#94a3b8" }}
                        />
                        {task.project.team.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{task.project.name}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5 font-medium">
                      <PriorityIcon priority={task.priority} />
                      {task.title}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: task.workflowState.color }} />
                      {task.workflowState.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {task.assignees[0] ? (
                      <span className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={task.assignees[0].user.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[9px]">{task.assignees[0].user.name[0]}</AvatarFallback>
                        </Avatar>
                        {task.assignees[0].user.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {task.dueDate ? (
                      format(new Date(task.dueDate), "MMM d, yyyy")
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <TaskDetailDialog />
    </>
  );
}
