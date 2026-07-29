"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Folder, Layers, Lock, Plus, ListChecks } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NewListDialog } from "@/components/hierarchy/new-list-dialog";
import { getOverview } from "@/lib/queries/hierarchy";

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${percent}%` }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

/**
 * ClickUp-style overview for a space or a folder: the lists it contains with
 * task progress, plus a "New List" row so lists can be created in place.
 */
export function ContainerOverview({
  workspaceId,
  teamId,
  folderId,
}: {
  workspaceId: string;
  teamId?: string;
  folderId?: string;
}) {
  const [newListOpen, setNewListOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["overview", workspaceId, teamId ?? null, folderId ?? null],
    queryFn: () => getOverview(workspaceId, { teamId, folderId }),
  });

  const base = `/workspace/${workspaceId}`;
  // Creating inside a folder still needs the owning space id for the list's teamId.
  const spaceIdForCreate = folderId ? data?.container.teamId : teamId;

  if (error) {
    return (
      <>
        <TopNav title="Not available" />
        <div className="p-6">
          <p className="text-sm text-muted-foreground">
            You don&apos;t have access to this {folderId ? "folder" : "space"}, or it no longer exists.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <TopNav title={data?.container.name ?? "Loading…"} />

      <div className="space-y-5 p-4 lg:p-6">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              backgroundColor: `${data?.container.color ?? "#f59e0b"}22`,
              color: data?.container.color ?? "#f59e0b",
            }}
          >
            {folderId ? <Folder className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-lg font-semibold">
              {data?.container.name ?? <Skeleton className="h-5 w-40" />}
              {data?.container.isPrivate && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            </h1>
            <p className="text-xs text-muted-foreground">
              {folderId ? "Folder" : "Space"}
              {data && !folderId && data.folders.length > 0
                ? ` · ${data.folders.length} folder${data.folders.length === 1 ? "" : "s"}`
                : ""}
              {data
                ? ` · ${data.lists.length} list${data.lists.length === 1 ? "" : "s"}${
                    !folderId && data.folders.length > 0 ? " directly here" : ""
                  }`
                : ""}
            </p>
          </div>
        </div>

        {/* Folders inside a space */}
        {!folderId && data?.folders && data.folders.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Folders</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.folders.map((f) => (
                <Link
                  key={f.id}
                  href={`${base}/folder/${f.id}`}
                  className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <Folder className="h-4 w-4 shrink-0" style={{ color: f.color ?? undefined }} />
                  <span className="truncate font-medium">{f.name}</span>
                  {f.isPrivate && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{f._count.projects}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Lists table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lists</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Progress</th>
                    <th className="px-4 py-2 font-medium">Start</th>
                    <th className="px-4 py-2 font-medium">End</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading &&
                    [0, 1, 2].map((i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-4 py-3" colSpan={5}>
                          <Skeleton className="h-4 w-full" />
                        </td>
                      </tr>
                    ))}

                  {data?.lists.map((list) => (
                    <tr key={list.id} className="border-b border-border transition-colors hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`${base}/projects/${list.id}/board`}
                          className="flex items-center gap-2 font-medium hover:text-primary"
                        >
                          <ListChecks className="h-3.5 w-3.5 shrink-0" style={{ color: list.color ?? undefined }} />
                          <span className="truncate">{list.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <ProgressBar percent={list.percent} />
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {list.completed}/{list.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {list.startDate ? format(new Date(list.startDate), "dd MMM yy") : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {list.targetDate ? format(new Date(list.targetDate), "dd MMM yy") : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{list.status}</td>
                    </tr>
                  ))}

                  {data && data.lists.length === 0 && (
                    <tr className="border-b border-border">
                      <td className="px-4 py-6 text-center text-xs text-muted-foreground" colSpan={5}>
                        {!folderId && data.folders.length > 0
                          ? "No lists directly in this space — open a folder above."
                          : "No lists here yet."}
                      </td>
                    </tr>
                  )}

                  {/* New List row, mirroring ClickUp */}
                  <tr>
                    <td colSpan={5} className="px-2 py-1.5">
                      <button
                        onClick={() => setNewListOpen(true)}
                        disabled={!spaceIdForCreate}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        New List
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {spaceIdForCreate && (
        <NewListDialog
          workspaceId={workspaceId}
          teamId={spaceIdForCreate}
          folderId={folderId}
          open={newListOpen}
          onOpenChange={setNewListOpen}
        />
      )}
    </>
  );
}
