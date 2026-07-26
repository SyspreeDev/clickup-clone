"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTask } from "@/lib/queries/tasks";
import { ApiError } from "@/lib/api-client";

export function CreateTaskDialog({
  projectId,
  workflowStateId,
}: {
  projectId: string;
  workflowStateId: string;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => createTask(projectId, { title, workflowStateId, priority: "NO_PRIORITY" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      setTitle("");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  function submit() {
    if (!title.trim()) {
      setAdding(false);
      return;
    }
    mutation.mutate();
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Add task
      </button>
    );
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-card p-2 shadow-soft">
      <Input
        autoFocus
        placeholder="Task title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setAdding(false);
        }}
      />
      <div className="flex items-center gap-1.5">
        <Button size="sm" onClick={submit} disabled={mutation.isPending}>
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
