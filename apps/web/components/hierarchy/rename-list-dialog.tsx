"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { updateProjectSchema, type UpdateProjectInput } from "@repo/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { updateProject } from "@/lib/queries/projects";
import { ApiError } from "@/lib/api-client";

/** Same pattern as RenameTeamDialog — see that component for the reasoning. */
export function RenameListDialog({
  workspaceId,
  projectId,
  currentName,
}: {
  workspaceId: string;
  projectId: string;
  currentName: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateProjectInput>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: { name: currentName },
  });

  const mutation = useMutation({
    mutationFn: (input: UpdateProjectInput) => updateProject(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tree", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("List renamed");
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
        Rename list
      </DropdownMenuItem>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename list</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-list-name">List name</Label>
            <Input id="rename-list-name" {...register("name")} />
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
