"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Kanban, List, CalendarDays, GanttChartSquare, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProject } from "@/lib/queries/projects";
import { Skeleton } from "@/components/ui/skeleton";

const VIEWS = [
  { key: "board", label: "Board", icon: Kanban },
  { key: "list", label: "List", icon: List },
  { key: "table", label: "Table", icon: Table2 },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "timeline", label: "Timeline", icon: GanttChartSquare },
];

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = use(params);
  const pathname = usePathname();

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });

  const base = `/workspace/${workspaceId}/projects/${projectId}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 pt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {project ? (
              <>
                <span
                  className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold"
                  style={{ backgroundColor: `${project.color ?? "#6366f1"}22`, color: project.color ?? "#6366f1" }}
                >
                  {project.key[0]}
                </span>
                <h1 className="truncate text-sm font-semibold">{project.name}</h1>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {project.key}
                </span>
              </>
            ) : (
              <Skeleton className="h-5 w-40" />
            )}
          </div>
        </div>
      </div>
      <nav className="flex items-center gap-1 border-b border-border px-4">
        {VIEWS.map((v) => {
          const href = `${base}/${v.key}`;
          const active = pathname === href;
          return (
            <Link
              key={v.key}
              href={href}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <v.icon className="h-3.5 w-3.5" />
              {v.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
