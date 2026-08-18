"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopNav } from "@/components/layout/top-nav";
import { KanbanBoard } from "@/components/views/kanban-board";
import { getProject } from "@/lib/queries/projects";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectTasks } from "@/hooks/use-project-tasks";
import { DEFAULT_TASK_FILTERS, TaskFilterBar, filterTasks } from "@/components/views/task-filter-bar";
import { useAuthStore } from "@/stores/auth-store";

export default function BoardPage({ params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
  const { projectId } = use(params);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });
  const { data: tasks, isLoading: tasksLoading } = useProjectTasks(projectId);
  const [filters, setFilters] = useState(DEFAULT_TASK_FILTERS);
  const userId = useAuthStore((s) => s.user?.id);
  const allTasks = tasks ?? [];
  const filteredTasks = filterTasks(allTasks, filters, userId);

  return (
    <>
      <TopNav />
      {isLoading || !project?.workflowStates ? null : (
        <TaskFilterBar filters={filters} onChange={setFilters} totalCount={allTasks.length} filteredCount={filteredTasks.length} />
      )}
      {isLoading || !project?.workflowStates || tasksLoading ? (
        <div className="flex flex-1 gap-4 overflow-x-auto p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-full w-72 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : (
        <KanbanBoard projectId={projectId} projectKey={project.key} workflowStates={project.workflowStates} tasks={filteredTasks} />
      )}
    </>
  );
}
