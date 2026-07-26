"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopNav } from "@/components/layout/top-nav";
import { TimelineView } from "@/components/views/timeline-view";
import { TaskDetailDialog } from "@/components/task/task-detail-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectTasks } from "@/hooks/use-project-tasks";
import { getProject } from "@/lib/queries/projects";

export default function TimelineViewPage({ params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
  const { projectId } = use(params);
  const { data: project } = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId) });
  const { data: tasks, isLoading } = useProjectTasks(projectId);

  return (
    <>
      <TopNav />
      {isLoading || !project ? (
        <div className="p-4">
          <Skeleton className="h-[500px] w-full" />
        </div>
      ) : (
        <TimelineView tasks={tasks ?? []} projectKey={project.key} />
      )}
      <TaskDetailDialog />
    </>
  );
}
