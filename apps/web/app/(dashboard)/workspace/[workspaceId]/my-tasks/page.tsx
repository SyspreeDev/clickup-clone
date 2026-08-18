"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopNav } from "@/components/layout/top-nav";
import { TaskRow } from "@/components/task/task-row";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyTasks } from "@/lib/queries/tasks";
import { CheckSquare } from "lucide-react";

export default function MyTasksPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["my-tasks", workspaceId],
    queryFn: () => listMyTasks(workspaceId),
  });

  return (
    <>
      <TopNav title="My Tasks" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}
        {!isLoading && !tasks?.length && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <CheckSquare className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nothing assigned to you</p>
            <p className="mt-1 text-sm text-muted-foreground">Tasks assigned to you across all projects show up here.</p>
          </div>
        )}
        {tasks?.map((task) => (
          <TaskRow key={task.id} task={task} projectKey="" />
        ))}
      </div>
    </>
  );
}
