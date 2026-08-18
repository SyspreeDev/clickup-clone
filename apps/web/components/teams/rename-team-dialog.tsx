"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { updateTeamSchema, type UpdateTeamInput } from "@repo/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { updateTeam } from "@/lib/queries/teams";
import { ApiError } from "@/lib/api-client";

/**
 * Wires the updateTeam PATCH round-trip (already worked end-to-end on the
 * backend, just never called from the UI) to a rename option. Triggered from
 * a DropdownMenuItem rather than its own button, so it slots into the same
 * per-team menu the admin dashboard already uses for other actions.
 */
export function RenameTeamDialog({
  workspaceId,
  teamId,
  currentName,
  currentDescription,
}: {
  workspaceId: string;
  teamId: string;
  currentName: string;
  /**
   * `null` = known to have no description (full team data available, e.g.
   * the admin dashboard). `undefined` = caller doesn't have the current
   * description at all (e.g. the sidebar tree, which only loads names) — in
   * that case the field is hidden and omitted from the submit payload
   * entirely, rather than risking silently overwriting it with "".
   */
  currentDescription: string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const knowsDescription = currentDescription !== undefined;
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateTeamInput>({
    resolver: zodResolver(updateTeamSchema),
    defaultValues: { name: currentName, ...(knowsDescription && { description: currentDescription ?? "" }) },
  });

  const mutation = useMutation({
    mutationFn: (input: UpdateTeamInput) =>
      updateTeam(teamId, knowsDescription ? input : { name: input.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      // The sidebar's space tree is a separate cache entry — without this the
      // rename shows on this page but the old name lingers in the sidebar.
      queryClient.invalidateQueries({ queryKey: ["tree", workspaceId] });
      toast.success("Team renamed");
      setOpen(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset({ name: currentName, ...(knowsDescription && { description: currentDescription ?? "" }) });
      }}
    >
      <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Rename team
      </DropdownMenuItem>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename team</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-name">Team name</Label>
            <Input id="rename-name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          {knowsDescription && (
            <div className="space-y-2">
              <Label htmlFor="rename-description">Description (optional)</Label>
              <Input id="rename-description" {...register("description")} />
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
