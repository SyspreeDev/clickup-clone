"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isPast } from "date-fns";
import { Building2, Search, User, X, Inbox } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { PriorityIcon, PRIORITY_CONFIG } from "@/components/task/priority-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaskDetailStore } from "@/stores/task-detail-store";
import { getAllTasks, type WorkspaceTaskItem } from "@/lib/queries/workspaces";
import { DEFAULT_TASK_FILTERS, filterTasks } from "@/components/views/task-filter-bar";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

type StatusBucket = "ALL" | "OPEN" | "CLOSED";

const PRIORITY_ORDER: WorkspaceTaskItem["priority"][] = ["URGENT", "HIGH", "MEDIUM", "LOW", "NO_PRIORITY"];

/** Lightens a hex color for a subtle pill background, keeping the original as the text color. */
function pillStyle(hex: string) {
  return { backgroundColor: `${hex}1f`, color: hex };
}

/**
 * Every task in every space/list in the workspace, in one list — deliberately not
 * scoped to the viewer's own teams. "Client" here means what it means everywhere
 * else in Teamspree: a task inside a delivery list, not a distinct data model.
 */
export default function ClientsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["all-tasks", workspaceId],
    queryFn: () => getAllTasks(workspaceId),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const openTask = useTaskDetailStore((s) => s.openTask);
  const userId = useAuthStore((s) => s.user?.id);
  const [filters, setFilters] = useState(DEFAULT_TASK_FILTERS);
  const [spaceId, setSpaceId] = useState("ALL");
  const [statusBucket, setStatusBucket] = useState<StatusBucket>("ALL");

  const allTasks = tasks ?? [];

  const spaces = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of allTasks) {
      if (t.project.team) map.set(t.project.team.id, t.project.team.name);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allTasks]);

  let visible = filterTasks(allTasks, filters, userId) as WorkspaceTaskItem[];
  if (spaceId !== "ALL") visible = visible.filter((t) => t.project.team?.id === spaceId);
  if (statusBucket !== "ALL") {
    visible = visible.filter((t) =>
      statusBucket === "CLOSED" ? t.workflowState.category === "COMPLETED" : t.workflowState.category !== "COMPLETED",
    );
  }

  const active =
    filters.query.trim() !== "" || filters.priority !== "ALL" || filters.onlyMine || spaceId !== "ALL" || statusBucket !== "ALL";

  function clearAll() {
    setFilters(DEFAULT_TASK_FILTERS);
    setSpaceId("ALL");
    setStatusBucket("ALL");
  }

  if (isLoading) {
    return (
      <>
        <TopNav title="Clients" />
        <div className="space-y-2 p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <TopNav title="Clients" />

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-5xl space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                placeholder="Search clients…"
                className="h-9 rounded-lg pl-9 text-sm"
              />
            </div>

            <Select value={spaceId} onValueChange={setSpaceId}>
              <SelectTrigger className="h-9 w-[150px] rounded-lg text-sm">
                <SelectValue placeholder="All spaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All spaces</SelectItem>
                {spaces.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusBucket} onValueChange={(v) => setStatusBucket(v as StatusBucket)}>
              <SelectTrigger className="h-9 w-[140px] rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Open &amp; closed</SelectItem>
                <SelectItem value="OPEN">Open only</SelectItem>
                <SelectItem value="CLOSED">Closed only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.priority} onValueChange={(v) => setFilters({ ...filters, priority: v as typeof filters.priority })}>
              <SelectTrigger className="h-9 w-[140px] rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Any priority</SelectItem>
                {PRIORITY_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_CONFIG[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              size="sm"
              variant={filters.onlyMine ? "default" : "secondary"}
              className="h-9 gap-1.5 rounded-lg"
              onClick={() => setFilters({ ...filters, onlyMine: !filters.onlyMine })}
            >
              <User className="h-3.5 w-3.5" />
              Assigned to me
            </Button>

            {active && (
              <Button type="button" size="sm" variant="ghost" className="h-9 gap-1 rounded-lg text-muted-foreground" onClick={clearAll}>
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}

            <span className="ml-auto shrink-0 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{visible.length}</span>
              {active ? ` of ${allTasks.length}` : ""} {allTasks.length === 1 ? "client" : "clients"}
            </span>
          </div>

          {!allTasks.length && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-24 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </span>
              <p className="text-sm font-medium">Nothing here yet</p>
              <p className="text-sm text-muted-foreground">Every task across every space in this workspace shows up here.</p>
            </div>
          )}

          {!!allTasks.length && !visible.length && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-24 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-5 w-5 text-muted-foreground" />
              </span>
              <p className="text-sm font-medium">Nothing matches these filters</p>
              <Button size="sm" variant="ghost" onClick={clearAll}>
                Clear filters
              </Button>
            </div>
          )}

          {!!visible.length && (
            <div className="space-y-1.5">
              {visible.map((task) => {
                const overdue = task.dueDate && isPast(new Date(task.dueDate)) && task.workflowState.category !== "COMPLETED";
                return (
                  <div
                    key={task.id}
                    onClick={() => openTask(task.id)}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3.5 py-3 transition-colors hover:border-border hover:bg-muted/40"
                  >
                    <PriorityIcon priority={task.priority} className="shrink-0" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {task.project.team && (
                          <>
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: task.project.team.color ?? "#94a3b8" }}
                            />
                            <span className="truncate">{task.project.team.name}</span>
                            <span className="shrink-0">·</span>
                          </>
                        )}
                        <span className="truncate">{task.project.name}</span>
                      </div>
                    </div>

                    <span
                      className="hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-block"
                      style={pillStyle(task.workflowState.color)}
                    >
                      {task.workflowState.name}
                    </span>

                    <div className="hidden w-32 shrink-0 items-center gap-1.5 md:flex">
                      {task.assignees[0] ? (
                        <>
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarImage src={task.assignees[0].user.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-[9px]">{task.assignees[0].user.name[0]}</AvatarFallback>
                          </Avatar>
                          <span className="truncate text-xs text-muted-foreground">{task.assignees[0].user.name}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">Unassigned</span>
                      )}
                    </div>

                    <span
                      className={cn(
                        "hidden w-20 shrink-0 text-right text-xs sm:inline-block",
                        overdue ? "font-medium text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {task.dueDate ? format(new Date(task.dueDate), "MMM d") : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
