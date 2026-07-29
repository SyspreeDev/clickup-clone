"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Hash, Lock, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TreeFolder, TreeList, TreeSpace } from "@/lib/queries/hierarchy";

/** One list row — the leaf of Space → Folder → List. */
function ListRow({
  list,
  base,
  depth,
  onNavigate,
}: {
  list: TreeList;
  base: string;
  depth: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname?.startsWith(`${base}/projects/${list.id}`) ?? false;

  return (
    <Link
      href={`${base}/projects/${list.id}/board`}
      onClick={onNavigate}
      style={{ paddingLeft: `${depth * 12 + 10}px` }}
      className={cn(
        "group flex items-center gap-2 rounded-lg py-1.5 pr-2 text-sm transition-colors",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-sidebar-foreground/80 hover:bg-sidebar-border/60 hover:text-sidebar-foreground",
      )}
      title={list.name}
    >
      <Hash className="h-3.5 w-3.5 shrink-0" style={{ color: list.color ?? undefined }} />
      <span className="truncate">{list.name}</span>
      {list._count.tasks > 0 && (
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">{list._count.tasks}</span>
      )}
    </Link>
  );
}

function FolderRow({
  folder,
  base,
  onNavigate,
}: {
  folder: TreeFolder;
  base: string;
  onNavigate?: () => void;
}) {
  // Folders start open so work is visible without hunting for it.
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-lg py-1.5 pl-[22px] pr-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-border/60 hover:text-sidebar-foreground"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        {open ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color: folder.color ?? undefined }} />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: folder.color ?? undefined }} />
        )}
        <span className="truncate">{folder.name}</span>
        {folder.isPrivate && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {folder.lists.length || ""}
        </span>
      </button>

      {open &&
        (folder.lists.length > 0 ? (
          folder.lists.map((list) => (
            <ListRow key={list.id} list={list} base={base} depth={3} onNavigate={onNavigate} />
          ))
        ) : (
          <p className="py-1 pl-[58px] text-xs text-muted-foreground">Empty folder</p>
        ))}
    </div>
  );
}

function SpaceRow({ space, base, onNavigate }: { space: TreeSpace; base: string; onNavigate?: () => void }) {
  const [open, setOpen] = useState(true);
  const listCount = space.lists.length + space.folders.reduce((n, f) => n + f.lists.length, 0);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-border/60"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded"
          style={{ backgroundColor: `${space.color ?? "#f59e0b"}22`, color: space.color ?? "#f59e0b" }}
        >
          <Layers className="h-2.5 w-2.5" />
        </span>
        <span className="truncate">{space.name}</span>
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">{listCount || ""}</span>
      </button>

      {open && (
        <>
          {space.folders.map((folder) => (
            <FolderRow key={folder.id} folder={folder} base={base} onNavigate={onNavigate} />
          ))}
          {space.lists.map((list) => (
            <ListRow key={list.id} list={list} base={base} depth={2} onNavigate={onNavigate} />
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
  base,
  onNavigate,
}: {
  spaces: TreeSpace[] | undefined;
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
        <SpaceRow key={space.id} space={space} base={base} onNavigate={onNavigate} />
      ))}
    </div>
  );
}
