"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getProject } from "@/lib/queries/projects";
import { addAssignee, removeAssignee } from "@/lib/queries/tasks";
import { ApiError } from "@/lib/api-client";
import type { TaskDetail } from "@/lib/queries/tasks";

export function AssigneePicker({ task }: { task: TaskDetail }) {
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ["project", task.projectId],
    queryFn: () => getProject(task.projectId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
  };

  const addMutation = useMutation({
    mutationFn: (userId: string) => addAssignee(task.id, userId),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Couldn't assign"),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeAssignee(task.id, userId),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Couldn't unassign"),
  });

  const assignedIds = new Set(task.assignees.map((a) => a.userId));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {task.assignees.map((a) => (
        <span key={a.id} className="flex items-center gap-1.5 rounded-full bg-background px-2 py-1 text-xs">
          <Avatar className="h-4 w-4">
            <AvatarImage src={a.user.avatarUrl ?? undefined} />
            <AvatarFallback className="text-[8px]">{a.user.name[0]}</AvatarFallback>
          </Avatar>
          {a.user.name}
          <button
            onClick={() => removeMutation.mutate(a.userId)}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${a.user.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary">
          <UserPlus className="h-3 w-3" />
          {task.assignees.length ? "" : "Assign"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Project members</DropdownMenuLabel>
          {project?.members?.map((m) => {
            const assigned = assignedIds.has(m.userId);
            return (
              <DropdownMenuItem
                key={m.userId}
                onClick={() => (assigned ? removeMutation.mutate(m.userId) : addMutation.mutate(m.userId))}
                className="justify-between"
              >
                <span className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={m.user.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[9px]">{m.user.name[0]}</AvatarFallback>
                  </Avatar>
                  {m.user.name}
                </span>
                {assigned && <span className="text-xs text-primary">Assigned</span>}
              </DropdownMenuItem>
            );
          })}
          {!project?.members?.length && <DropdownMenuItem disabled>No members on this project</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
