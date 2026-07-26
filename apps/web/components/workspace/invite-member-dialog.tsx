"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { inviteMemberSchema, type InviteMemberInput, ROLES } from "@repo/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { InviteLinkReveal } from "@/components/workspace/invite-link-reveal";
import { inviteMember } from "@/lib/queries/workspaces";
import { ApiError } from "@/lib/api-client";

export function InviteMemberDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ email: string; link: string; alreadyHasAccount: boolean } | null>(null);
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InviteMemberInput>({ resolver: zodResolver(inviteMemberSchema), defaultValues: { role: "MEMBER" } });

  const mutation = useMutation({
    mutationFn: (input: InviteMemberInput) => inviteMember(workspaceId, input),
    onSuccess: (member, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      setResult({ email: variables.email, link: member.inviteLink, alreadyHasAccount: member.alreadyHasAccount });
      reset();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <InviteLinkReveal {...result} />
            <DialogFooter>
              <Button variant="secondary" onClick={() => setResult(null)}>
                Invite another
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="teammate@company.com" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={watch("role")} onValueChange={(v) => setValue("role", v as InviteMemberInput["role"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r !== "OWNER").map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Sending…" : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
