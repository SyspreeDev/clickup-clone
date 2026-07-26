"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createWorkspaceSchema, type CreateWorkspaceInput } from "@repo/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createWorkspace } from "@/lib/queries/workspaces";
import { getMe } from "@/lib/queries/auth";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api-client";

export default function CreateWorkspacePage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceInput>({ resolver: zodResolver(createWorkspaceSchema) });

  async function onSubmit(values: CreateWorkspaceInput) {
    try {
      const workspace = await createWorkspace(values);
      const user = await getMe();
      setUser(user);
      toast.success(`${workspace.name} is ready`);
      router.push(`/workspace/${workspace.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your workspace</CardTitle>
          <CardDescription>This is where your team&apos;s projects, tasks and conversations will live.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace name</Label>
              <Input id="name" placeholder="Acme Inc" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" placeholder="What does your team do?" {...register("description")} />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create workspace"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
