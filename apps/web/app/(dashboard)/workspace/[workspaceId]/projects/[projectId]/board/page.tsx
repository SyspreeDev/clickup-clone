"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopNav } from "@/components/layout/top-nav";
import { KanbanBoard } from "@/components/views/kanban-board";
import { TaskDetailDialog } from "@/components/task/task-detail-dialog";
import { getProject } from "@/lib/queries/projects";
import { Skeleton } from "@/components/ui/skeleton";

export default function BoardPage({ params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
  const { projectId } = use(params);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });

  return (
    <>
      <TopNav />
      {isLoading || !project?.workflowStates ? (
        <div className="flex flex-1 gap-4 overflow-x-auto p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-full w-72 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : (
        <KanbanBoard projectId={projectId} projectKey={project.key} workflowStates={project.workflowStates} />
      )}
      <TaskDetailDialog />
    </>
  );
}
