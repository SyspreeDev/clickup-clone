"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Hash, Lock, Layers, MoreHorizontal, Archive, Trash2, FolderInput } from "lucide-react";
import { cn } from "@/lib/utils";
import { NewListButton } from "@/components/hierarchy/new-list-dialog";
import { MoveListDialog } from "@/components/hierarchy/move-list-dialog";
import { RenameFolderDialog } from "@/components/hierarchy/rename-folder-dialog";
import { RenameListDialog } from "@/components/hierarchy/rename-list-dialog";
import { RenameTeamDialog } from "@/components/teams/rename-team-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteFolder } from "@/lib/queries/hierarchy";
import { archiveProject } from "@/lib/queries/projects";
import { deleteTeam } from "@/lib/queries/teams";
import { ApiError } from "@/lib/api-client";
import type { TreeFolder, TreeList, TreeSpace } from "@/lib/queries/hierarchy";

/** Small pill for a list/folder/team's item count — reads as a count, not a stray number floating next to the name. */
function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="shrink-0 rounded-full bg-sidebar-border/70 px-1.5 py-[1px] text-[10px] font-medium tabular-nums text-sidebar-foreground/70">
      {count}
    </span>
  );
}

/** One list row — the leaf of Space → Folder → List. */
function ListRow({
  list,
  base,
  depth,
  workspaceId,
  allSpaces,
  onNavigate,
}: {
  list: TreeList;
  base: string;
  depth: number;
  workspaceId: string;
  allSpaces: TreeSpace[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname?.startsWith(`${base}/projects/${list.id}`) ?? false;
  const queryClient = useQueryClient();
  const [moveOpen, setMoveOpen] = useState(false);

  const archiveMutation = useMutation({
    mutationFn: () => archiveProject(list.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tree", workspaceId] });
      toast.success(`"${list.name}" archived`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <div className="group/row flex items-center gap-1 rounded-lg pr-1.5 transition-colors hover:bg-sidebar-border/60">
      <Link
        href={`${base}/projects/${list.id}/list`}
        onClick={onNavigate}
        style={{ paddingLeft: `${depth * 12 + 10}px` }}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 text-sm transition-colors",
          active ? "font-medium text-primary" : "text-sidebar-foreground/80 hover:text-sidebar-foreground",
        )}
        title={list.name}
      >
        <Hash className="h-3.5 w-3.5 shrink-0" style={{ color: list.color ?? undefined }} />
        <span className="truncate">{list.name}</span>
      </Link>
      <CountBadge count={list._count.tasks} />
      <DropdownMenu>
        <DropdownMenuTrigger
          className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-sidebar-border hover:text-sidebar-foreground group-hover/row:opacity-100"
          aria-label={`Manage ${list.name}`}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <RenameListDialog workspaceId={workspaceId} projectId={list.id} currentName={list.name} />
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setMoveOpen(true)}>
            <FolderInput className="h-4 w-4" />
            Move list
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              if (window.confirm(`Archive "${list.name}"? It will disappear from the sidebar but its tasks are kept — this is reversible from the workspace admin, not a permanent delete.`)) {
                archiveMutation.mutate();
              }
            }}
          >
            <Archive className="h-4 w-4" />
            Archive list
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MoveListDialog workspaceId={workspaceId} list={list} spaces={allSpaces} open={moveOpen} onOpenChange={setMoveOpen} />
    </div>
  );
}

function FolderRow({
  folder,
  spaceId,
  workspaceId,
  allSpaces,
  base,
  onNavigate,
}: {
  folder: TreeFolder;
  spaceId: string;
  workspaceId: string;
  allSpaces: TreeSpace[];
  base: string;
  onNavigate?: () => void;
}) {
  // Folders start open so work is visible without hunting for it.
  const [open, setOpen] = useState(true);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteFolder(folder.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tree", workspaceId] });
      toast.success(`"${folder.name}" deleted`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <div>
      <div className="group/row flex items-center gap-1 rounded-lg pr-1.5 transition-colors hover:bg-sidebar-border/60">
        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 pl-[22px] text-sidebar-foreground/80"
          aria-label={open ? "Collapse folder" : "Expand folder"}
          aria-expanded={open}
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <Link
          href={`${base}/folder/${folder.id}`}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground"
          title={folder.name}
        >
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded"
            style={{ backgroundColor: `${folder.color ?? "#94a3b8"}22`, color: folder.color ?? "#94a3b8" }}
          >
            {open ? <FolderOpen className="h-2.5 w-2.5" /> : <Folder className="h-2.5 w-2.5" />}
          </span>
          <span className="truncate">{folder.name}</span>
          {folder.isPrivate && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </Link>
        <NewListButton workspaceId={workspaceId} teamId={spaceId} folderId={folder.id} label="New list in folder" />
        <CountBadge count={folder.lists.length} />
        <DropdownMenu>
          <DropdownMenuTrigger
            className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-sidebar-border hover:text-sidebar-foreground group-hover/row:opacity-100"
            aria-label={`Manage ${folder.name}`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <RenameFolderDialog workspaceId={workspaceId} folderId={folder.id} currentName={folder.name} />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete folder "${folder.name}"? Its ${folder.lists.length} list(s) are NOT deleted — they move directly into the team. This cannot be undone.`,
                  )
                ) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {open &&
        (folder.lists.length > 0 ? (
          folder.lists.map((list) => (
            <ListRow
              key={list.id}
              list={list}
              base={base}
              depth={3}
              workspaceId={workspaceId}
              allSpaces={allSpaces}
              onNavigate={onNavigate}
            />
          ))
        ) : (
          <p className="py-1 pl-[58px] text-xs text-muted-foreground">Empty folder</p>
        ))}
    </div>
  );
}

function SpaceRow({
  space,
  workspaceId,
  allSpaces,
  base,
  onNavigate,
}: {
  space: TreeSpace;
  workspaceId: string;
  allSpaces: TreeSpace[];
  base: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const listCount = space.lists.length + space.folders.reduce((n, f) => n + f.lists.length, 0);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteTeam(space.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tree", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["teams", workspaceId] });
      toast.success(`"${space.name}" deleted`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <div>
      <div className="group/row flex items-center gap-1 rounded-lg pr-1.5 transition-colors hover:bg-sidebar-border/60">
        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 pl-2 text-sidebar-foreground"
          aria-label={open ? "Collapse team" : "Expand team"}
          aria-expanded={open}
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <Link
          href={`${base}/space/${space.id}`}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2 py-2 text-sm font-semibold text-sidebar-foreground"
          title={space.name}
        >
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: `${space.color ?? "#f59e0b"}22`, color: space.color ?? "#f59e0b" }}
          >
            <Layers className="h-3 w-3" />
          </span>
          <span className="truncate">{space.name}</span>
        </Link>
        <NewListButton workspaceId={workspaceId} teamId={space.id} label="New list in team" />
        <CountBadge count={listCount} />
        <DropdownMenu>
          <DropdownMenuTrigger
            className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-sidebar-border hover:text-sidebar-foreground group-hover/row:opacity-100"
            aria-label={`Manage ${space.name}`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <RenameTeamDialog
              workspaceId={workspaceId}
              teamId={space.id}
              currentName={space.name}
              currentDescription={undefined}
            />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete team "${space.name}"? Its ${listCount} list(s) are NOT deleted — they become unassigned rather than destroyed. This cannot be undone.`,
                  )
                ) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete team
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {open && (
        <>
          {space.folders.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              spaceId={space.id}
              workspaceId={workspaceId}
              allSpaces={allSpaces}
              base={base}
              onNavigate={onNavigate}
            />
          ))}
          {space.lists.map((list) => (
            <ListRow
              key={list.id}
              list={list}
              base={base}
              depth={2}
              workspaceId={workspaceId}
              allSpaces={allSpaces}
              onNavigate={onNavigate}
            />
          ))}
          {listCount === 0 && space.folders.length === 0 && (
            <p className="py-1 pl-[38px] text-xs text-muted-foreground">No lists yet</p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Renders the ClickUp-style Space → Folder → List tree. The API has already
 * filtered this to what the signed-in user may open, so anything absent here is
 * absent because they have no access to it.
 */
export function SidebarTree({
  spaces,
  workspaceId,
  base,
  onNavigate,
}: {
  spaces: TreeSpace[] | undefined;
  workspaceId: string;
  base: string;
  onNavigate?: () => void;
}) {
  if (!spaces) {
    return (
      <div className="space-y-1 px-2 py-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-sidebar-border/50" />
        ))}
      </div>
    );
  }

  if (spaces.length === 0) {
    return <p className="px-2.5 py-1 text-xs text-muted-foreground">No teams yet</p>;
  }

  return (
    <div className="space-y-3">
      {spaces.map((space) => (
        <SpaceRow
          key={space.id}
          space={space}
          workspaceId={workspaceId}
          allSpaces={spaces}
          base={base}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}
