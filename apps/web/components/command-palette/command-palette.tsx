"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, CheckSquare, Users2, FolderKanban, Plus, BarChart3, FileText, Hash, CalendarClock } from "lucide-react";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { listProjects } from "@/lib/queries/projects";
import { search as searchApi } from "@/lib/queries/search";
import { cn } from "@/lib/utils";

export function CommandPalette({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const isOpen = useCommandPaletteStore((s) => s.isOpen);
  const open = useCommandPaletteStore((s) => s.open);
  const close = useCommandPaletteStore((s) => s.close);
  const [query, setQuery] = React.useState("");

  const { data: projects } = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => listProjects(workspaceId),
    enabled: isOpen,
  });

  const { data: results } = useQuery({
    queryKey: ["search", workspaceId, query],
    queryFn: () => searchApi(workspaceId, query),
    enabled: isOpen && query.length >= 2,
  });

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  function go(path: string) {
    router.push(path);
    close();
  }

  const base = `/workspace/${workspaceId}`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[15vh]" onClick={close}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover shadow-soft-lg animate-in fade-in-0 zoom-in-95">
        <Command shouldFilter={query.length < 2} className={cn("[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground")}>
          <div className="flex items-center border-b border-border px-3">
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search tasks, projects, people…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-96 overflow-y-auto p-2 scrollbar-thin">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">No results found.</Command.Empty>

            {query.length >= 2 && !!results?.tasks.length && (
              <Command.Group heading="Tasks">
                {results.tasks.map((t) => (
                  <Item key={t.id} icon={CheckSquare} onSelect={() => go(`${base}/projects/${t.project.id}/board`)}>
                    {t.title}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {t.project.key}-{t.number}
                    </span>
                  </Item>
                ))}
              </Command.Group>
            )}

            {query.length >= 2 && !!results?.projects.length && (
              <Command.Group heading="Projects">
                {results.projects.map((p) => (
                  <Item key={p.id} icon={FolderKanban} onSelect={() => go(`${base}/projects/${p.id}/board`)}>
                    {p.name}
                    <span className="ml-auto text-xs text-muted-foreground">{p.key}</span>
                  </Item>
                ))}
              </Command.Group>
            )}

            {query.length >= 2 && !!results?.members.length && (
              <Command.Group heading="People">
                {results.members.map((m) => (
                  <Item key={m.id} icon={Users2} onSelect={() => go(`${base}/settings/members`)}>
                    {m.name}
                    <span className="ml-auto text-xs text-muted-foreground">{m.email}</span>
                  </Item>
                ))}
              </Command.Group>
            )}

            {query.length >= 2 && !!results?.files.length && (
              <Command.Group heading="Files">
                {results.files.map((f) => (
                  <Item key={f.id} icon={FileText} onSelect={() => go(`${base}/files`)}>
                    {f.name}
                  </Item>
                ))}
              </Command.Group>
            )}

            {query.length < 2 && (
              <>
                <Command.Group heading="Navigate">
                  <Item icon={LayoutDashboard} onSelect={() => go(base)}>Dashboard</Item>
                  <Item icon={CheckSquare} onSelect={() => go(`${base}/my-tasks`)}>My Tasks</Item>
                  <Item icon={Users2} onSelect={() => go(`${base}/teams`)}>Teams</Item>
                  <Item icon={Hash} onSelect={() => go(`${base}/chat`)}>Chat</Item>
                  <Item icon={CalendarClock} onSelect={() => go(`${base}/meetings`)}>Meetings</Item>
                  <Item icon={FileText} onSelect={() => go(`${base}/files`)}>Files</Item>
                  <Item icon={BarChart3} onSelect={() => go(`${base}/reports`)}>Reports</Item>
                </Command.Group>

                <Command.Group heading="Quick create">
                  <Item icon={Plus} onSelect={() => go(`${base}/projects/new`)}>New project</Item>
                </Command.Group>
              </>
            )}

            {query.length < 2 && !!projects?.length && (
              <Command.Group heading="Projects">
                {projects.map((p) => (
                  <Item key={p.id} icon={FolderKanban} onSelect={() => go(`${base}/projects/${p.id}/board`)}>
                    {p.name}
                    <span className="ml-auto text-xs text-muted-foreground">{p.key}</span>
                  </Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function Item({
  icon: Icon,
  onSelect,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-accent"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {children}
    </Command.Item>
  );
}
