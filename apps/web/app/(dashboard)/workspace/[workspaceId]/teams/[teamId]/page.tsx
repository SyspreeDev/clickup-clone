"use client";

import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AddTeamMemberDialog } from "@/components/teams/add-team-member-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getTeam, removeTeamMember } from "@/lib/queries/teams";
import { ApiError } from "@/lib/api-client";

export default function TeamDetailPage({ params }: { params: Promise<{ workspaceId: string; teamId: string }> }) {
  const { workspaceId, teamId } = use(params);
  const queryClient = useQueryClient();

  const { data: team, isLoading } = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => getTeam(teamId),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeTeamMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      toast.success("Member removed");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  if (isLoading || !team) {
    return (
      <>
        <TopNav title="Team" />
        <div className="p-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <TopNav title={team.name} />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-4xl space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">
                {team.name[0]?.toUpperCase()}
              </span>
              <div>
                <h2 className="text-lg font-semibold">{team.name}</h2>
                {team.description && <p className="text-sm text-muted-foreground">{team.description}</p>}
              </div>
            </div>
            <AddTeamMemberDialog
              workspaceId={workspaceId}
              teamId={teamId}
              existingUserIds={team.members.map((m) => m.userId)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Members ({team.members.length})</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {team.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={m.user.avatarUrl ?? undefined} />
                      <AvatarFallback>{m.user.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{m.user.name}</p>
                      <p className="text-xs text-muted-foreground">{m.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.workspaceStatus === "INVITED" && <Badge variant="outline">Pending invite</Badge>}
                    <Badge variant="outline">{m.role.replace("_", " ")}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded p-1 text-muted-foreground hover:bg-accent">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => removeMutation.mutate(m.userId)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove from team
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
