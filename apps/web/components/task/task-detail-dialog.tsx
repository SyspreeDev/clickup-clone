"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Trash2, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PriorityIcon, priorityLabel, PRIORITY_CONFIG } from "@/components/task/priority-icon";
import { ChecklistSection } from "@/components/task/checklist-section";
import { CommentSection } from "@/components/task/comment-section";
import { AssigneePicker } from "@/components/task/assignee-picker";
import { StatusPicker } from "@/components/task/status-picker";
import { useTaskDetailStore } from "@/stores/task-detail-store";
import { getTask, updateTask, deleteTask } from "@/lib/queries/tasks";
import { listWorkflowStates } from "@/lib/queries/projects";
import { ApiError } from "@/lib/api-client";
import { TASK_PRIORITIES } from "@repo/shared-types";

export function TaskDetailDialog() {
  const openTaskId = useTaskDetailStore((s) => s.openTaskId);
  const close = useTaskDetailStore((s) => s.close);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { data: task } = useQuery({
    queryKey: ["task", openTaskId],
    queryFn: () => getTask(openTaskId!),
    enabled: !!openTaskId,
  });

  // The status dropdown needs this list's own statuses, not just the current one.
  const { data: states } = useQuery({
    queryKey: ["workflow-states", task?.projectId],
    queryFn: () => listWorkflowStates(task!.projectId),
    enabled: !!task?.projectId,
  });

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(typeof task.description === "string" ? task.description : "");
    }
  }, [task]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["task", openTaskId] });
    if (task) queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
  };

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateTask>[1]) => updateTask(openTaskId!, input),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(openTaskId!),
    onSuccess: () => {
      if (task) queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
      toast.success("Task deleted");
      close();
    },
  });

  if (!openTaskId) return null;

  return (
    <Dialog open={!!openTaskId} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        {!task ? (
          <div className="flex h-96 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid max-h-[85vh] grid-cols-1 md:grid-cols-[1fr_260px]">
            <div className="flex max-h-[85vh] flex-col overflow-y-auto scrollbar-thin p-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span>
                  {task.project.key}-{task.number}
                </span>
              </div>
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => title.trim() && title !== task.title && updateMutation.mutate({ title })}
                rows={1}
                className="mb-4 resize-none overflow-hidden bg-transparent text-xl font-semibold leading-snug outline-none"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => updateMutation.mutate({ description })}
                placeholder="Add a description…"
                rows={4}
                className="mb-6 resize-none rounded-lg border border-transparent bg-transparent p-2 text-sm outline-none transition-colors hover:border-border focus:border-border"
              />

              <ChecklistSection task={task} onChange={invalidate} />
              <Separator className="my-4" />
              <CommentSection task={task} />
            </div>

            <div className="space-y-4 border-t border-border bg-muted/30 p-5 md:border-l md:border-t-0">
              <Field label="Status">
                <StatusPicker
                  taskId={task.id}
                  projectId={task.projectId}
                  states={states}
                  currentStateId={task.workflowStateId}
                  currentPosition={task.position}
                />
              </Field>

              <Field label="Priority">
                <Select value={task.priority} onValueChange={(v) => updateMutation.mutate({ priority: v as never })}>
                  <SelectTrigger className="h-8">
                    <SelectValue>
                      <span className="flex items-center gap-1.5">
                        <PriorityIcon priority={task.priority} />
                        {priorityLabel(task.priority)}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-1.5">
                          <PriorityIcon priority={p} />
                          {PRIORITY_CONFIG[p].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Assignees">
                <AssigneePicker task={task} />
              </Field>

              <Field label="Due date">
                <Input
                  type="date"
                  className="h-8"
                  value={task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : ""}
                  onChange={(e) => updateMutation.mutate({ dueDate: e.target.value ? new Date(e.target.value) : null })}
                />
              </Field>

              <Field label="Created by">
                <div className="flex items-center gap-1.5 text-sm">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={task.createdBy.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[9px]">{task.createdBy.name[0]}</AvatarFallback>
                  </Avatar>
                  {task.createdBy.name}
                </div>
              </Field>

              <Separator />

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-1.5 text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete task
              </Button>
            </div>
          </div>
        )}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
