"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from "@/lib/queries/tasks";
import type { TaskDetail } from "@/lib/queries/tasks";

export function ChecklistSection({ task, onChange }: { task: TaskDetail; onChange: () => void }) {
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [addingChecklist, setAddingChecklist] = useState(false);
  const queryClient = useQueryClient();

  const invalidate = () => {
    onChange();
    queryClient.invalidateQueries({ queryKey: ["task", task.id] });
  };

  const createChecklistMutation = useMutation({
    mutationFn: (title: string) => createChecklist(task.id, title),
    onSuccess: () => {
      invalidate();
      setNewChecklistTitle("");
      setAddingChecklist(false);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <CheckSquare className="h-4 w-4" />
          Checklists
        </p>
        <Button variant="ghost" size="sm" onClick={() => setAddingChecklist(true)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {task.checklists.map((checklist) => (
        <ChecklistBlock key={checklist.id} checklist={checklist} onChange={invalidate} />
      ))}

      {addingChecklist && (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            placeholder="Checklist name"
            value={newChecklistTitle}
            onChange={(e) => setNewChecklistTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newChecklistTitle.trim() && createChecklistMutation.mutate(newChecklistTitle)}
          />
          <Button size="sm" onClick={() => newChecklistTitle.trim() && createChecklistMutation.mutate(newChecklistTitle)}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

function ChecklistBlock({
  checklist,
  onChange,
}: {
  checklist: TaskDetail["checklists"][number];
  onChange: () => void;
}) {
  const [newItem, setNewItem] = useState("");
  const [adding, setAdding] = useState(false);

  const addItemMutation = useMutation({
    mutationFn: (title: string) => addChecklistItem(checklist.id, title),
    onSuccess: () => {
      onChange();
      setNewItem("");
      setAdding(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) => updateChecklistItem(id, { isCompleted }),
    onSuccess: onChange,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteChecklistItem(id),
    onSuccess: onChange,
  });

  const completed = checklist.items.filter((i) => i.isCompleted).length;

  return (
    <div className="space-y-1.5 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{checklist.title}</p>
        <span className="text-xs text-muted-foreground">
          {completed}/{checklist.items.length}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${checklist.items.length ? (completed / checklist.items.length) * 100 : 0}%` }}
        />
      </div>
      <div className="space-y-1 pt-1">
        {checklist.items.map((item) => (
          <div key={item.id} className="group flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.isCompleted}
              onChange={(e) => toggleMutation.mutate({ id: item.id, isCompleted: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            <span className={`flex-1 text-sm ${item.isCompleted ? "text-muted-foreground line-through" : ""}`}>{item.title}</span>
            <button
              onClick={() => deleteMutation.mutate(item.id)}
              className="opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>
      {adding ? (
        <div className="flex items-center gap-1.5 pt-1">
          <Input
            autoFocus
            className="h-7 text-sm"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newItem.trim() && addItemMutation.mutate(newItem)}
            onBlur={() => !newItem.trim() && setAdding(false)}
          />
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="pt-1 text-xs text-muted-foreground hover:text-foreground">
          + Add item
        </button>
      )}
    </div>
  );
}
