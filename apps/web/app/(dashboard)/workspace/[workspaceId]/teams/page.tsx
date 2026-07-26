"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users2 } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { listTeams } from "@/lib/queries/teams";

export default function TeamsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams", workspaceId],
    queryFn: () => listTeams(workspaceId),
  });

  return (
    <>
      <TopNav title="Teams" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-5xl space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Teams</h2>
              <p className="text-sm text-muted-foreground">Organize members into teams that own projects.</p>
            </div>
            <CreateTeamDialog workspaceId={workspaceId} />
          </div>

          {isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-2xl" />
              ))}
            </div>
          )}

          {!isLoading && !teams?.length && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
              <Users2 className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No teams yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create your first team to start organizing work.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams?.map((team) => (
              <Link key={team.id} href={`/workspace/${workspaceId}/teams/${team.id}`}>
                <Card className="h-full transition-shadow hover:shadow-soft-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                        {team.name[0]?.toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{team.name}</CardTitle>
                        <p className="truncate text-xs text-muted-foreground">{team._count?.projects ?? 0} projects</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {team.description && <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{team.description}</p>}
                    <div className="flex -space-x-2">
                      {team.members.slice(0, 5).map((m) => (
                        <Avatar key={m.id} className="h-6 w-6 border-2 border-card">
                          <AvatarImage src={m.user.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[10px]">{m.user.name[0]}</AvatarFallback>
                        </Avatar>
                      ))}
                      {team.members.length > 5 && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium">
                          +{team.members.length - 5}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
