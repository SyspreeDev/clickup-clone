"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, SearchX } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { TaskRow } from "@/components/task/task-row";
import { CreateTaskDialog } from "@/components/task/create-task-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectTasks } from "@/hooks/use-project-tasks";
import { getProject } from "@/lib/queries/projects";
import { DEFAULT_TASK_FILTERS, TaskFilterBar, filterTasks, hasActiveFilters } from "@/components/views/task-filter-bar";
import { useAuthStore } from "@/stores/auth-store";

export default function ListViewPage({ params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
  const { projectId } = use(params);
  const { data: project } = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId) });
  const { data: tasks, isLoading } = useProjectTasks(projectId);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState(DEFAULT_TASK_FILTERS);
  const userId = useAuthStore((s) => s.user?.id);

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

  const allTasks = tasks ?? [];
  const filteredTasks = filterTasks(allTasks, filters, userId);
  const filtering = hasActiveFilters(filters);
  const grouped = project.workflowStates
    .map((state) => ({
      state,
      tasks: filteredTasks.filter((t) => t.workflowStateId === state.id).sort((a, b) => a.position - b.position),
    }))
    // While searching/filtering a large list, empty status headers are just noise.
    .filter(({ tasks: stateTasks }) => !filtering || stateTasks.length > 0);

  return (
    <>
      <TopNav />
      <TaskFilterBar filters={filters} onChange={setFilters} totalCount={allTasks.length} filteredCount={filteredTasks.length} />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtering && filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <SearchX className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">No tasks match these filters</p>
            <button onClick={() => setFilters(DEFAULT_TASK_FILTERS)} className="text-xs text-primary hover:underline">
              Clear filters
            </button>
          </div>
        )}
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
                    <TaskRow
                      key={task.id}
                      task={task}
                      projectKey={project.key}
                      states={project.workflowStates}
                    />
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
    </>
  );
}
