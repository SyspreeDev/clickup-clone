"use client";

import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, ShieldAlert, Trash2, Users2 } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { AddTeamMemberDialog } from "@/components/teams/add-team-member-dialog";
import { RenameTeamDialog } from "@/components/teams/rename-team-dialog";
import { listTeams, removeTeamMember, type Team } from "@/lib/queries/teams";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

function TeamAdminCard({ workspaceId, team }: { workspaceId: string; team: Team }) {
  const queryClient = useQueryClient();

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeTeamMember(team.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams", workspaceId] });
      toast.success("Member removed");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
            {team.name[0]?.toUpperCase()}
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{team.name}</CardTitle>
            {team.description && <p className="truncate text-xs text-muted-foreground">{team.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <AddTeamMemberDialog
            workspaceId={workspaceId}
            teamId={team.id}
            existingUserIds={team.members.map((m) => m.userId)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded p-1.5 text-muted-foreground hover:bg-accent">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <RenameTeamDialog
                workspaceId={workspaceId}
                teamId={team.id}
                currentName={team.name}
                currentDescription={team.description}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-border pt-0">
        {team.members.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">No members yet — add the first one above.</p>
        )}
        {team.members.map((m) => (
          <div key={m.id} className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={m.user.avatarUrl ?? undefined} />
                <AvatarFallback>{m.user.name[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.user.name}</p>
                {m.user.email && <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {m.workspaceStatus === "INVITED" && <Badge variant="outline">Pending invite</Badge>}
              <Badge variant="outline">{m.role.replace("_", " ")}</Badge>
              <button
                onClick={() => removeMutation.mutate(m.userId)}
                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                title="Remove from team"
                aria-label={`Remove ${m.user.name} from ${team.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Default landing page for managing who has access to what: every team, its
 * members, and their pending-invite status, with add/remove/rename actions
 * inline — instead of admin work being split across the teams list and each
 * team's own detail page. Restricted to workspace OWNER/ADMIN; the underlying
 * team endpoints already enforce this server-side, this just avoids showing
 * the page to someone who'd only get 403s from every action on it.
 */
export default function AdminDashboardPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const user = useAuthStore((s) => s.user);
  const role = user?.workspaces.find((w) => w.id === workspaceId)?.role;
  const isAdmin = role === "OWNER" || role === "ADMIN";

  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams", workspaceId],
    queryFn: () => listTeams(workspaceId),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <>
        <TopNav title="Admin" />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">You don&apos;t have access to this page</p>
          <p className="text-sm text-muted-foreground">Only workspace owners and admins can manage team access.</p>
        </div>
      </>
    );
  }

  const totalMembers = new Set(teams?.flatMap((t) => t.members.map((m) => m.userId))).size;

  return (
    <>
      <TopNav title="Admin" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-4xl space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Team access</h2>
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? "Loading teams…"
                  : `${teams?.length ?? 0} team${teams?.length === 1 ? "" : "s"} · ${totalMembers} unique member${totalMembers === 1 ? "" : "s"}`}
              </p>
            </div>
            <CreateTeamDialog workspaceId={workspaceId} />
          </div>

          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-2xl" />
              ))}
            </div>
          )}

          {!isLoading && !teams?.length && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
              <Users2 className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No teams yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create a team, then add members to it from here.</p>
            </div>
          )}

          <div className="space-y-4">
            {teams?.map((team) => (
              <TeamAdminCard key={team.id} workspaceId={workspaceId} team={team} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
