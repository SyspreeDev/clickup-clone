"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { TaskRow } from "@/components/task/task-row";
import { TaskDetailDialog } from "@/components/task/task-detail-dialog";
import { CreateTaskDialog } from "@/components/task/create-task-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectTasks } from "@/hooks/use-project-tasks";
import { getProject } from "@/lib/queries/projects";

export default function ListViewPage({ params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
  const { projectId } = use(params);
  const { data: project } = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId) });
  const { data: tasks, isLoading } = useProjectTasks(projectId);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (isLoading || !project?.workflowStates) {
    return (
      <>
        <TopNav />
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </>
    );
  }

  const grouped = project.workflowStates.map((state) => ({
    state,
    tasks: (tasks ?? []).filter((t) => t.workflowStateId === state.id).sort((a, b) => a.position - b.position),
  }));

  return (
    <>
      <TopNav />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {grouped.map(({ state, tasks: stateTasks }) => {
          const isCollapsed = collapsed.has(state.id);
          return (
            <div key={state.id}>
              <button
                onClick={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    next.has(state.id) ? next.delete(state.id) : next.add(state.id);
                    return next;
                  })
                }
                className="flex w-full items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-left"
              >
                {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: state.color }} />
                <span className="text-sm font-medium">{state.name}</span>
                <span className="text-xs text-muted-foreground">{stateTasks.length}</span>
              </button>
              {!isCollapsed && (
                <div>
                  {stateTasks.map((task) => (
                    <TaskRow key={task.id} task={task} projectKey={project.key} />
                  ))}
                  <div className="px-4 py-1.5">
                    <CreateTaskDialog projectId={projectId} workflowStateId={state.id} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <TaskDetailDialog />
    </>
  );
}
