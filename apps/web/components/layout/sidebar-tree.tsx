"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Hash, Lock, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { NewListButton } from "@/components/hierarchy/new-list-dialog";
import { MoveListButton } from "@/components/hierarchy/move-list-dialog";
import type { TreeFolder, TreeList, TreeSpace } from "@/lib/queries/hierarchy";

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
      {list._count.tasks > 0 && (
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{list._count.tasks}</span>
      )}
      <MoveListButton workspaceId={workspaceId} list={list} spaces={allSpaces} />
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
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color: folder.color ?? undefined }} />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: folder.color ?? undefined }} />
          )}
          <span className="truncate">{folder.name}</span>
          {folder.isPrivate && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </Link>
        <NewListButton workspaceId={workspaceId} teamId={spaceId} folderId={folder.id} label="New list in folder" />
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{folder.lists.length || ""}</span>
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

  return (
    <div>
      <div className="group/row flex items-center gap-1 rounded-lg pr-1.5 transition-colors hover:bg-sidebar-border/60">
        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 pl-2 text-sidebar-foreground"
          aria-label={open ? "Collapse space" : "Expand space"}
          aria-expanded={open}
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <Link
          href={`${base}/space/${space.id}`}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-sm font-semibold text-sidebar-foreground"
          title={space.name}
        >
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded"
            style={{ backgroundColor: `${space.color ?? "#f59e0b"}22`, color: space.color ?? "#f59e0b" }}
          >
            <Layers className="h-2.5 w-2.5" />
          </span>
          <span className="truncate">{space.name}</span>
        </Link>
        <NewListButton workspaceId={workspaceId} teamId={space.id} label="New list in space" />
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{listCount || ""}</span>
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
    return <p className="px-2.5 py-1 text-xs text-muted-foreground">No spaces yet</p>;
  }

  return (
    <div className="space-y-0.5">
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
