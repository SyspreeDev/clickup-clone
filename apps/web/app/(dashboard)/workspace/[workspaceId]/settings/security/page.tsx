"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { changePassword, listApiTokens, createApiToken, revokeApiToken } from "@/lib/queries/users";
import { ApiError } from "@/lib/api-client";

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
}

export default function SecuritySettingsPage() {
  const { register, handleSubmit, reset } = useForm<PasswordForm>();
  const [newTokenName, setNewTokenName] = useState("");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const passwordMutation = useMutation({
    mutationFn: (input: PasswordForm) => changePassword(input),
    onSuccess: () => {
      toast.success("Password updated");
      reset();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  const { data: tokens } = useQuery({ queryKey: ["api-tokens"], queryFn: listApiTokens });

  const createTokenMutation = useMutation({
    mutationFn: (name: string) => createApiToken(name),
    onSuccess: (token) => {
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
      setRevealedToken(token.token);
      setNewTokenName("");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeApiToken(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-tokens"] }),
  });

  return (
    <>
      <TopNav title="Security" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-2xl space-y-6 p-6">
          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>Use a strong, unique password for your account.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit((v) => passwordMutation.mutate(v))} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current password</Label>
                  <Input id="currentPassword" type="password" {...register("currentPassword", { required: true })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input id="newPassword" type="password" {...register("newPassword", { required: true, minLength: 8 })} />
                </div>
                <Button type="submit" disabled={passwordMutation.isPending}>
                  {passwordMutation.isPending ? "Updating…" : "Update password"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API tokens</CardTitle>
              <CardDescription>Use tokens to authenticate scripts and integrations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {revealedToken && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="mb-1 text-xs font-medium text-primary">Copy this token now — you won&apos;t see it again</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate text-xs">{revealedToken}</code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(revealedToken);
                        toast.success("Copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  placeholder="Token name (e.g. CI pipeline)"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                />
                <Button
                  disabled={!newTokenName.trim() || createTokenMutation.isPending}
                  onClick={() => createTokenMutation.mutate(newTokenName)}
                >
                  Create
                </Button>
              </div>

              <div className="divide-y divide-border">
                {tokens?.map((token) => (
                  <div key={token.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{token.name}</p>
                        <p className="text-xs text-muted-foreground">Created {format(new Date(token.createdAt), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => revokeMutation.mutate(token.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {!tokens?.length && <p className="py-2 text-sm text-muted-foreground">No API tokens yet.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
