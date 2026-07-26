"use client";

import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth-store";
import { updateProfile } from "@/lib/queries/users";
import { getMe } from "@/lib/queries/auth";
import { ApiError } from "@/lib/api-client";

interface ProfileForm {
  name: string;
  jobTitle: string;
  phone: string;
}

export default function ProfileSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { register, handleSubmit, formState: { isDirty } } = useForm<ProfileForm>({
    defaultValues: { name: user?.name ?? "", jobTitle: user?.jobTitle ?? "", phone: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: ProfileForm) => updateProfile(input),
    onSuccess: async () => {
      setUser(await getMe());
      toast.success("Profile updated");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <>
      <TopNav title="Profile" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-2xl space-y-6 p-6">
          <Card>
            <CardHeader>
              <CardTitle>Your profile</CardTitle>
              <CardDescription>This information is visible to your teammates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user?.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-lg">{user?.name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" {...register("name")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job title</Label>
                  <Input id="jobTitle" placeholder="Product Designer" {...register("jobTitle")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="+1 555 0100" {...register("phone")} />
                </div>
                <Button type="submit" disabled={!isDirty || mutation.isPending}>
                  {mutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
