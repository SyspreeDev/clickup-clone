"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { moveProject } from "@/lib/queries/hierarchy";
import type { TreeList, TreeSpace } from "@/lib/queries/hierarchy";
import { ApiError } from "@/lib/api-client";

const NO_FOLDER = "__none__";

/**
 * Reparents a list into a different space (and optionally a folder within it).
 * The API already supported this (moveProject) — this was the missing UI, needed
 * for cleaning up lists that landed in a catch-all "ClickUp Import" space.
 */
export function MoveListDialog({
  workspaceId,
  list,
  spaces,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  list: TreeList;
  spaces: TreeSpace[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [teamId, setTeamId] = useState(list.teamId ?? spaces[0]?.id ?? "");
  const [folderId, setFolderId] = useState(list.folderId ?? NO_FOLDER);
  const queryClient = useQueryClient();

  const selectedSpace = spaces.find((s) => s.id === teamId);
  const folderOptions = selectedSpace?.folders ?? [];

  function handleSpaceChange(nextTeamId: string) {
    setTeamId(nextTeamId);
    setFolderId(NO_FOLDER);
  }

  const mutation = useMutation({
    mutationFn: () =>
      moveProject(list.id, folderId === NO_FOLDER ? { folderId: null, teamId } : { folderId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tree", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(`Moved "${list.name}"`);
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not move this list"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move &quot;{list.name}&quot;</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="move-space">Space</Label>
            <select
              id="move-space"
              value={teamId}
              onChange={(e) => handleSpaceChange(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="move-folder">Folder</Label>
            <select
              id="move-folder"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value={NO_FOLDER}>No folder — directly in the space</option>
              {folderOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={!teamId || mutation.isPending}>
            {mutation.isPending ? "Moving…" : "Move list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small "⋯" trigger used in the sidebar list row. */
export function MoveListButton({
  workspaceId,
  list,
  spaces,
}: {
  workspaceId: string;
  list: TreeList;
  spaces: TreeSpace[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Move list"
        title="Move list"
        className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-sidebar-border hover:text-sidebar-foreground focus:opacity-100 group-hover/row:opacity-100"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      <MoveListDialog workspaceId={workspaceId} list={list} spaces={spaces} open={open} onOpenChange={setOpen} />
    </>
  );
}
