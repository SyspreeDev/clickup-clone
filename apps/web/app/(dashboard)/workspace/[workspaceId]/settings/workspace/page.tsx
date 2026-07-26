"use client";

import { use, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateWorkspaceSchema, type UpdateWorkspaceInput } from "@repo/shared-types";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkspace, updateWorkspace } from "@/lib/queries/workspaces";
import { ApiError } from "@/lib/api-client";

export default function WorkspaceSettingsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const queryClient = useQueryClient();

  const { data: workspace, isLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => getWorkspace(workspaceId),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateWorkspaceInput>({ resolver: zodResolver(updateWorkspaceSchema) });

  useEffect(() => {
    if (workspace) reset({ name: workspace.name, description: workspace.description ?? "" });
  }, [workspace, reset]);

  const mutation = useMutation({
    mutationFn: (input: UpdateWorkspaceInput) => updateWorkspace(workspaceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      toast.success("Workspace updated");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <>
      <TopNav title="Workspace settings" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-2xl space-y-6 p-6">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>Basic information about your workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Workspace name</Label>
                    <Input id="name" {...register("name")} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" {...register("description")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Workspace URL</Label>
                    <Input disabled value={`flowspace.app/${workspace?.slug}`} />
                  </div>
                  <Button type="submit" disabled={!isDirty || mutation.isPending}>
                    {mutation.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
