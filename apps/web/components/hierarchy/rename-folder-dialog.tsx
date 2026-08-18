"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { updateProjectFolderSchema, type UpdateProjectFolderInput } from "@repo/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { updateFolder } from "@/lib/queries/hierarchy";
import { ApiError } from "@/lib/api-client";

/** Same pattern as RenameTeamDialog — see that component for the reasoning. */
export function RenameFolderDialog({
  workspaceId,
  folderId,
  currentName,
}: {
  workspaceId: string;
  folderId: string;
  currentName: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateProjectFolderInput>({
    resolver: zodResolver(updateProjectFolderSchema),
    defaultValues: { name: currentName },
  });

  const mutation = useMutation({
    mutationFn: (input: UpdateProjectFolderInput) => updateFolder(folderId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tree", workspaceId] });
      toast.success("Folder renamed");
      setOpen(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset({ name: currentName });
      }}
    >
      <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Rename folder
      </DropdownMenuItem>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-folder-name">Folder name</Label>
            <Input id="rename-folder-name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
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
