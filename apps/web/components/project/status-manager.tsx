"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GripVertical, Plus, Settings2, Trash2 } from "lucide-react";
import { WORKFLOW_CATEGORIES, type WorkflowCategory } from "@repo/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  listWorkflowStates,
  createWorkflowState,
  updateWorkflowState,
  deleteWorkflowState,
} from "@/lib/queries/projects";
import { ApiError } from "@/lib/api-client";

const PRESET_COLORS = [
  "#6b7280", "#3b82f6", "#8b5cf6", "#ec4899",
  "#ef4444", "#f59e0b", "#eab308", "#22c55e",
  "#14b8a6", "#0ea5e9",
];

/** Plain-language labels — "UNSTARTED" means little to someone building a status set. */
const CATEGORY_LABELS: Record<WorkflowCategory, string> = {
  BACKLOG: "Backlog — not scheduled",
  UNSTARTED: "To do — open, not started",
  STARTED: "In progress — actively worked on",
  COMPLETED: "Closed — counts as done",
  CANCELLED: "Closed — cancelled",
};

/**
 * Lets a list own its status set, the way each ClickUp list does — so
 * "MOCKUP / FIGMA- PRANITA" and "IN REVIEW" can exist on one list without
 * imposing them on every other list.
 *
 * Category matters beyond labelling: progress bars, dashboard KPIs and reports
 * all count a task as done when its status sits in a Closed category.
 */
export function StatusManager({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[1]);
  const [newCategory, setNewCategory] = useState<WorkflowCategory>("UNSTARTED");
  /** Set while asking where the tasks in a non-empty status should go. */
  const [pendingDelete, setPendingDelete] = useState<{ id: string; moveToId: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: states } = useQuery({
    queryKey: ["workflow-states", projectId],
    queryFn: () => listWorkflowStates(projectId),
    enabled: open,
  });

  const ordered = [...(states ?? [])].sort((a, b) => a.position - b.position);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["workflow-states", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
  };

  const onError = (err: unknown) =>
    toast.error(err instanceof ApiError ? err.message : "Something went wrong");

  const create = useMutation({
    mutationFn: () =>
      createWorkflowState(projectId, {
        name: newName.trim(),
        color: newColor,
        category: newCategory,
        position: (ordered.at(-1)?.position ?? 0) + 1,
      }),
    onSuccess: () => {
      invalidate();
      setNewName("");
      toast.success("Status added");
    },
    onError,
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateWorkflowState(id, { name }),
    onSuccess: invalidate,
    onError,
  });

  const recolor = useMutation({
    mutationFn: ({ id, color }: { id: string; color: string }) => updateWorkflowState(id, { color }),
    onSuccess: invalidate,
    onError,
  });

  const recategorise = useMutation({
    mutationFn: ({ id, category }: { id: string; category: WorkflowCategory }) =>
      updateWorkflowState(id, { category }),
    onSuccess: invalidate,
    onError,
  });

  const remove = useMutation({
    mutationFn: ({ id, moveToId }: { id: string; moveToId?: string }) => deleteWorkflowState(id, moveToId),
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
      toast.success("Status removed");
    },
    onError,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Statuses
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Statuses for this list</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Each list has its own statuses. Anything in a <strong>Closed</strong> category counts as
          completed in progress bars and reports.
        </p>

        <div className="max-h-[320px] space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
          {ordered.map((state) => (
            <div key={state.id} className="rounded-lg border border-border p-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />

              <input
                type="color"
                value={state.color}
                onChange={(e) => recolor.mutate({ id: state.id, color: e.target.value })}
                className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label={`Colour for ${state.name}`}
                title="Change colour"
              />

              <Input
                defaultValue={state.name}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== state.name) rename.mutate({ id: state.id, name });
                }}
                className="h-8 flex-1"
                aria-label={`Rename ${state.name}`}
              />

              <Select
                value={state.category}
                onValueChange={(v) => recategorise.mutate({ id: state.id, category: v as WorkflowCategory })}
              >
                <SelectTrigger className="h-8 w-[210px] shrink-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {state._count?.tasks ?? 0}
              </span>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  if ((state._count?.tasks ?? 0) === 0) {
                    remove.mutate({ id: state.id });
                    return;
                  }
                  // Tasks have to land somewhere — offer the first other status.
                  const fallback = ordered.find((s) => s.id !== state.id);
                  if (fallback) setPendingDelete({ id: state.id, moveToId: fallback.id });
                }}
                disabled={ordered.length <= 1 || remove.isPending}
                title={ordered.length <= 1 ? "A list needs at least one status" : "Delete status"}
                aria-label={`Delete ${state.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {pendingDelete?.id === state.id && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-muted/60 p-2 text-xs">
                <span>
                  Move {state._count?.tasks} task{state._count?.tasks === 1 ? "" : "s"} to
                </span>
                <Select
                  value={pendingDelete.moveToId}
                  onValueChange={(v) => setPendingDelete({ id: state.id, moveToId: v })}
                >
                  <SelectTrigger className="h-7 w-[170px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ordered
                      .filter((s) => s.id !== state.id)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(pendingDelete)}
                >
                  Move &amp; delete
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setPendingDelete(null)}>
                  Cancel
                </Button>
              </div>
            )}
            </div>
          ))}

          {states && ordered.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">No statuses yet.</p>
          )}
        </div>

        <form
          className="space-y-2 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) create.mutate();
          }}
        >
          <Label className="text-xs">Add a status</Label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex shrink-0 items-center gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="h-5 w-5 rounded-full ring-offset-2 ring-offset-background transition-all"
                  style={{
                    backgroundColor: c,
                    boxShadow: newColor === c ? `0 0 0 2px var(--background), 0 0 0 4px ${c}` : undefined,
                  }}
                  aria-label={`Use colour ${c}`}
                />
              ))}
            </div>

            <Input
              placeholder="MOCKUP / FIGMA"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 min-w-[160px] flex-1"
            />

            <Select value={newCategory} onValueChange={(v) => setNewCategory(v as WorkflowCategory)}>
              <SelectTrigger className="h-8 w-[210px] shrink-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKFLOW_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button type="submit" size="sm" className="gap-1" disabled={!newName.trim() || create.isPending}>
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
