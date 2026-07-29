"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { createLabel, getProject } from "@/lib/queries/projects";
import { addLabel, removeLabel } from "@/lib/queries/tasks";
import { ApiError } from "@/lib/api-client";
import type { TaskDetail } from "@/lib/queries/tasks";

const TAG_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b", "#22c55e", "#14b8a6"];

/**
 * ClickUp's Tags field. Tags live on the list, so a new one typed here becomes
 * available to every client in the same list — which is what makes "wordpress"
 * or "no revert from the client" reusable rather than per-task free text.
 */
export function TagPicker({ task }: { task: TaskDetail }) {
  const [newName, setNewName] = useState("");
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ["project", task.projectId],
    queryFn: () => getProject(task.projectId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
  };

  const onError = (err: unknown) =>
    toast.error(err instanceof ApiError ? err.message : "Something went wrong");

  const attach = useMutation({
    mutationFn: (labelId: string) => addLabel(task.id, labelId),
    onSuccess: invalidate,
    onError,
  });

  const detach = useMutation({
    mutationFn: (labelId: string) => removeLabel(task.id, labelId),
    onSuccess: invalidate,
    onError,
  });

  const create = useMutation({
    mutationFn: async () => {
      const colour = TAG_COLORS[(project?.labels?.length ?? 0) % TAG_COLORS.length];
      const label = await createLabel(task.projectId, { name: newName.trim(), color: colour });
      await addLabel(task.id, label.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", task.projectId] });
      invalidate();
      setNewName("");
    },
    onError,
  });

  const attached = new Set(task.taskLabels.map((tl) => tl.labelId));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {task.taskLabels.map(({ label }) => (
        <span
          key={label.id}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: `${label.color}22`, color: label.color }}
        >
          {label.name}
          <button
            onClick={() => detach.mutate(label.id)}
            className="opacity-60 transition-opacity hover:opacity-100"
            aria-label={`Remove tag ${label.name}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 rounded border border-dashed border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary">
          <Plus className="h-3 w-3" />
          {task.taskLabels.length ? "" : "Tag"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Tags on this list</DropdownMenuLabel>
          {project?.labels?.map((label) => (
            <DropdownMenuItem
              key={label.id}
              onClick={() => (attached.has(label.id) ? detach.mutate(label.id) : attach.mutate(label.id))}
              className="justify-between"
            >
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
                {label.name}
              </span>
              {attached.has(label.id) && <span className="text-xs text-primary">Added</span>}
            </DropdownMenuItem>
          ))}
          {!project?.labels?.length && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No tags yet.</p>
          )}

          <DropdownMenuSeparator />
          <div className="p-1" onKeyDown={(e) => e.stopPropagation()}>
            <Input
              placeholder="New tag…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  e.preventDefault();
                  create.mutate();
                }
              }}
              className="h-7 text-xs"
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
