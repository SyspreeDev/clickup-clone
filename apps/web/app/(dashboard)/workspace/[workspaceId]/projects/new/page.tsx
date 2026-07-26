"use client";

import { use, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { createProjectSchema, type CreateProjectInput } from "@repo/shared-types";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProject } from "@/lib/queries/projects";
import { listTeams } from "@/lib/queries/teams";
import { ApiError } from "@/lib/api-client";

function slugifyKey(name: string) {
  const words = name.replace(/[^a-zA-Z0-9 ]/g, "").split(" ").filter(Boolean);
  const initials = words.map((w) => w[0]).join("").toUpperCase();
  if (initials.length >= 2) return initials.slice(0, 6);
  const alnum = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return alnum.length >= 2 ? alnum.slice(0, 6) : "PRJ";
}

export default function NewProjectPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const router = useRouter();

  const { data: teams } = useQuery({ queryKey: ["teams", workspaceId], queryFn: () => listTeams(workspaceId) });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { status: "PLANNED", isPrivate: false },
  });

  const name = watch("name");
  const keyTouched = useRef(false);

  useEffect(() => {
    if (!keyTouched.current && name) {
      setValue("key", slugifyKey(name), { shouldValidate: false });
    }
  }, [name, setValue]);

  const mutation = useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(workspaceId, input),
    onSuccess: (project) => {
      toast.success(`${project.name} created`);
      router.push(`/workspace/${workspaceId}/projects/${project.id}/board`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <>
      <TopNav title="New project" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>Create a project</CardTitle>
              <CardDescription>Projects group tasks into Kanban boards, lists, calendars and more.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleSubmit((v) => mutation.mutate({ ...v, key: v.key || slugifyKey(v.name) }))}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Project name</Label>
                  <Input id="name" placeholder="Website Relaunch" {...register("name")} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key">Project key</Label>
                  <Input
                    id="key"
                    placeholder={name ? slugifyKey(name) : "ENG"}
                    {...register("key", {
                      onChange: (e) => {
                        keyTouched.current = true;
                        e.target.value = e.target.value.toUpperCase();
                      },
                    })}
                  />
                  <p className="text-xs text-muted-foreground">Used as task IDs, e.g. ENG-123. Leave blank to auto-generate.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" placeholder="What's this project about?" {...register("description")} />
                </div>
                {!!teams?.length && (
                  <div className="space-y-2">
                    <Label>Team (optional)</Label>
                    <Select onValueChange={(v) => setValue("teamId", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="No team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? "Creating…" : "Create project"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
