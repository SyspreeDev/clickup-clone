"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, X, Search } from "lucide-react";
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
  const [query, setQuery] = useState("");

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

  // Assignable people are decided by team membership, not by being added to the
  // list one at a time — `project.members` only ever holds the rare explicit/
  // guest case, so on its own it left almost every list's picker empty.
  const candidates = useMemo(() => {
    const byUserId = new Map<string, { userId: string; user: { name: string; avatarUrl: string | null } }>();
    for (const m of project?.team?.members ?? []) byUserId.set(m.userId, m);
    for (const m of project?.members ?? []) byUserId.set(m.userId, m);
    const all = Array.from(byUserId.values()).sort((a, b) => a.user.name.localeCompare(b.user.name));
    const q = query.trim().toLowerCase();
    return q ? all.filter((m) => m.user.name.toLowerCase().includes(q)) : all;
  }, [project, query]);

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

      <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
        <DropdownMenuTrigger className="flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary">
          <UserPlus className="h-3 w-3" />
          {task.assignees.length ? "" : "Assign"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>{project?.team ? `${project.team.name} members` : "Team members"}</DropdownMenuLabel>
          {(project?.team?.members?.length ?? 0) + (project?.members?.length ?? 0) > 6 && (
            <div className="relative mx-2 mb-1.5">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Search…"
                className="h-7 w-full rounded-md border border-input bg-background pl-6 pr-2 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
          {candidates.map((m) => {
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
          {!candidates.length && (
            <DropdownMenuItem disabled>{query ? "No one matches" : "No members on this team yet"}</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
