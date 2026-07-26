"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { InviteLinkReveal } from "@/components/workspace/invite-link-reveal";
import { listMembers, inviteMember } from "@/lib/queries/workspaces";
import { addTeamMember } from "@/lib/queries/teams";
import { ApiError } from "@/lib/api-client";
import { ROLES } from "@repo/shared-types";
import { cn } from "@/lib/utils";

export function AddTeamMemberDialog({
  workspaceId,
  teamId,
  existingUserIds,
}: {
  workspaceId: string;
  teamId: string;
  existingUserIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [role, setRole] = useState<string>("MEMBER");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("MEMBER");
  const [inviteResult, setInviteResult] = useState<{ email: string; link: string; alreadyHasAccount: boolean } | null>(null);
  const queryClient = useQueryClient();

  const { data: members } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => listMembers(workspaceId),
    enabled: open,
  });

  const candidates = members?.filter((m) => !existingUserIds.includes(m.userId)) ?? [];

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["team", teamId] });
    queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
  };

  const addMutation = useMutation({
    mutationFn: () => addTeamMember(teamId, { userId, role: role as never }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Member added");
      setOpen(false);
      setUserId("");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const member = await inviteMember(workspaceId, { email: inviteEmail, role: inviteRole as never });
      await addTeamMember(teamId, { userId: member.userId, role: inviteRole as never });
      return member;
    },
    onSuccess: (member) => {
      invalidateAll();
      setInviteResult({ email: inviteEmail, link: member.inviteLink, alreadyHasAccount: member.alreadyHasAccount });
      setInviteEmail("");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setInviteResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          Add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
        </DialogHeader>

        {inviteResult ? (
          <div className="space-y-4">
            <InviteLinkReveal {...inviteResult} />
            <DialogFooter>
              <Button variant="secondary" onClick={() => setInviteResult(null)}>
                Add another
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Existing workspace member</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder={candidates.length ? "Select a member" : "Everyone in the workspace is already on this team"} />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.user.name} — {m.user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={!userId || addMutation.isPending} onClick={() => addMutation.mutate()}>
                {addMutation.isPending ? "Adding…" : "Add to team"}
              </Button>

              <div className="relative py-1">
                <Separator />
                <span className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground")}>
                  or
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-email">Invite someone new by email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="name@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Adds them to the workspace and this team in one step. You'll get a link to share with them yourself.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
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
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                disabled={!inviteEmail.trim() || inviteMutation.isPending}
                onClick={() => inviteMutation.mutate()}
              >
                {inviteMutation.isPending ? "Inviting…" : "Invite & add to team"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
