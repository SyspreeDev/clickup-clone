"use client";

import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InviteMemberDialog } from "@/components/workspace/invite-member-dialog";
import { listMembers, removeMember, updateMemberRole } from "@/lib/queries/workspaces";
import { ApiError } from "@/lib/api-client";
import { ROLES } from "@repo/shared-types";

export default function WorkspaceMembersPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => listMembers(workspaceId),
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) => updateMemberRole(workspaceId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      toast.success("Role updated");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeMember(workspaceId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      toast.success("Member removed");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <>
      <TopNav title="Members" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-4xl space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Workspace members</h2>
              <p className="text-sm text-muted-foreground">Manage who has access and what they can do.</p>
            </div>
            <InviteMemberDialog workspaceId={workspaceId} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{members?.length ?? 0} members</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="my-2 h-12 w-full" />)}
              {members?.map((m) => (
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
                    {m.status === "INVITED" && <Badge variant="outline">Invited</Badge>}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-accent">
                        {m.role.replace("_", " ")}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Change role</DropdownMenuLabel>
                        {ROLES.map((r) => (
                          <DropdownMenuItem key={r} onClick={() => roleMutation.mutate({ memberId: m.id, role: r })}>
                            {r.replace("_", " ")}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => removeMutation.mutate(m.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove from workspace
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
