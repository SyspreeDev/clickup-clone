"use client";

import { useQuery } from "@tanstack/react-query";
import { listTasks } from "@/lib/queries/tasks";

export function useProjectTasks(projectId: string) {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => listTasks(projectId),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
}
