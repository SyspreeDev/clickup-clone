"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createProject } from "@/lib/queries/projects";
import { ApiError } from "@/lib/api-client";

/** Uppercase alphanumeric key (max 8) derived from the list name, e.g. "Web Development" -> "WEBDEV". */
function suggestKey(name: string) {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 8) || "LIST";
}

/**
 * Creates a list directly inside a space or a folder, mirroring ClickUp's
 * "New List" affordance. Pass folderId to nest it in a folder, or just teamId
 * to drop it straight into the space.
 */
export function NewListDialog({
  workspaceId,
  teamId,
  folderId,
  open,
  onOpenChange,
  trigger,
}: {
  workspaceId: string;
  teamId: string;
  folderId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;

  const [name, setName] = useState("");
  const [customKey, setCustomKey] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Derived, not stored: the key tracks the name until the user overrides it.
  const key = customKey ?? suggestKey(name);

  const setOpen = (next: boolean) => {
    // Reset here rather than in an effect — no cascading render.
    if (!next) {
      setName("");
      setCustomKey(null);
    }
    (onOpenChange ?? setInternalOpen)(next);
  };

  const mutation = useMutation({
    mutationFn: () =>
      createProject(workspaceId, {
        name: name.trim(),
        key: key.trim().toUpperCase(),
        teamId,
        ...(folderId ? { folderId } : {}),
        status: "ACTIVE",
        isPrivate: false,
      }),
    onSuccess: (list) => {
      // Refresh the sidebar tree and whichever overview is open.
      queryClient.invalidateQueries({ queryKey: ["tree", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(`List "${list.name}" created`);
      setOpen(false);
      router.push(`/workspace/${workspaceId}/projects/${list.id}/list`);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Could not create the list"),
  });

  const canSubmit = name.trim().length >= 2 && /^[A-Z0-9]{2,8}$/.test(key.trim().toUpperCase());

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New list{folderId ? " in this folder" : " in this space"}</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="list-name">List name</Label>
            <Input
              id="list-name"
              autoFocus
              placeholder="Web Development"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="list-key">Task prefix</Label>
            <Input
              id="list-key"
              placeholder="WEBDEV"
              value={key}
              onChange={(e) => setCustomKey(e.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted-foreground">
              Used for task IDs like {key || "WEBDEV"}-1. Uppercase letters and numbers, 2–8 characters.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create list"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Small "+" button used in the sidebar rows. */
export function NewListButton({
  workspaceId,
  teamId,
  folderId,
  label = "New list",
}: {
  workspaceId: string;
  teamId: string;
  folderId?: string;
  label?: string;
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
        aria-label={label}
        title={label}
        className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-sidebar-border hover:text-sidebar-foreground focus:opacity-100 group-hover/row:opacity-100"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <NewListDialog
        workspaceId={workspaceId}
        teamId={teamId}
        folderId={folderId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
