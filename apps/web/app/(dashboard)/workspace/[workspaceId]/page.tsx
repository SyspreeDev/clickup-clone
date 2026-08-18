"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format, isPast, differenceInCalendarDays } from "date-fns";
import {
  FolderKanban,
  Users2,
  CheckSquare,
  CircleCheck,
  Clock,
  Plus,
  CalendarClock,
  AlertTriangle,
  PieChart,
  Zap,
  ListChecks,
  Flag,
  History,
  CalendarDays,
  Video,
} from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TaskOverviewChart } from "@/components/dashboard/task-overview-chart";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { AiInsightsCard } from "@/components/dashboard/ai-insights-card";
import { MyTasksWidget } from "@/components/dashboard/my-tasks-widget";
import { PriorityBreakdown } from "@/components/dashboard/priority-breakdown";
import { ActivityIcon } from "@/components/dashboard/activity-icon";
import { SectionIcon } from "@/components/dashboard/section-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskDetailDialog } from "@/components/task/task-detail-dialog";
import { getDashboard } from "@/lib/queries/workspaces";
import { listMyTasks } from "@/lib/queries/tasks";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

function activityLabel(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function WorkspaceDashboardPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const openPalette = useCommandPaletteStore((s) => s.open);
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", workspaceId],
    queryFn: () => getDashboard(workspaceId),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const { data: myTasks } = useQuery({
    queryKey: ["my-tasks", workspaceId],
    queryFn: () => listMyTasks(workspaceId),
    refetchInterval: 10_000,
  });

  const base = `/workspace/${workspaceId}`;
  const firstName = user?.name?.split(" ")[0];

  const overdueTasks = (myTasks ?? []).filter(
    (t) => t.dueDate && isPast(new Date(t.dueDate)) && t.workflowState.category !== "COMPLETED" && t.workflowState.category !== "CANCELLED",
  );

  return (
    <>
      <TopNav title="Dashboard" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-6xl space-y-6 p-6">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-5">
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(circle at 12% 0%, hsl(var(--primary) / 0.14), transparent 55%)" }}
            />
            <div className="relative flex flex-col gap-1">
              <h2 className="text-xl font-semibold tracking-tight">
                {greeting()}{firstName ? `, ${firstName}` : ""} 👋
              </h2>
              <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d")} — here&apos;s what&apos;s happening.</p>
            </div>
          </div>

          {overdueTasks.length > 0 && (
            <Link
              href={`${base}/my-tasks`}
              className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm transition-colors hover:bg-destructive/10"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <span>
                You have <span className="font-semibold text-destructive">{overdueTasks.length}</span>{" "}
                {overdueTasks.length === 1 ? "task" : "tasks"} overdue.
              </span>
              <span className="ml-auto shrink-0 text-xs font-medium text-destructive underline-offset-2 hover:underline">Review now</span>
            </Link>
          )}

          {isLoading || !data ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard
                index={0}
                label="Active Projects"
                value={data.kpis.activeProjects}
                icon={FolderKanban}
                accent="primary"
                hint="Projects in this workspace you can access that aren't archived or on hold."
              />
              <KpiCard
                index={1}
                label="Team Members"
                value={data.kpis.teamMembers}
                icon={Users2}
                accent="muted"
                hint="People who have accepted an invite and are active in this workspace."
                href={`${base}/teams`}
              />
              <KpiCard
                index={2}
                label="My Tasks"
                value={data.kpis.myTasks}
                icon={CheckSquare}
                accent="primary"
                hint="Tasks assigned to you that aren't finished yet, across every project you can access."
                href={`${base}/my-tasks`}
              />
              <KpiCard
                index={3}
                label="Completed"
                value={data.kpis.completedTasks}
                icon={CircleCheck}
                accent="success"
                hint="Tasks marked done in projects you can access."
              />
              <KpiCard
                index={4}
                label="Pending"
                value={data.kpis.pendingTasks}
                icon={Clock}
                accent="destructive"
                hint="Tasks still open (not done) in projects you can access — this includes tasks not assigned to you."
              />
              <KpiCard
                index={5}
                label="Overdue"
                value={overdueTasks.length}
                icon={AlertTriangle}
                accent={overdueTasks.length > 0 ? "destructive" : "muted"}
                hint="Your own assigned tasks whose due date has already passed."
                href={`${base}/my-tasks`}
              />
            </div>
          )}

          <AiInsightsCard />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center gap-2.5 space-y-0">
                <SectionIcon icon={PieChart} tone="primary" />
                <CardTitle>Task overview</CardTitle>
              </CardHeader>
              <CardContent>
                {data ? (
                  <TaskOverviewChart completed={data.kpis.completedTasks} pending={data.kpis.pendingTasks} />
                ) : (
                  <Skeleton className="h-48 w-full" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center gap-2.5 space-y-0">
                <SectionIcon icon={Zap} tone="amber" />
                <CardTitle>Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "New task", icon: Plus, onClick: () => openPalette(), accent: "bg-primary/10 text-primary" },
                  { label: "New project", icon: FolderKanban, href: `${base}/projects/new`, accent: "bg-blue-500/10 text-blue-500" },
                  { label: "Invite team", icon: Users2, href: `${base}/teams`, accent: "bg-success/10 text-success" },
                  { label: "Schedule meeting", icon: CalendarClock, href: `${base}/meetings`, accent: "bg-amber-500/10 text-amber-500" },
                ].map((action) => {
                  const inner = (
                    <Button
                      variant="secondary"
                      className="h-auto w-full flex-col gap-2 py-4 transition-transform hover:-translate-y-0.5"
                      onClick={action.onClick}
                    >
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", action.accent)}>
                        <action.icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs">{action.label}</span>
                    </Button>
                  );
                  return action.href ? (
                    <Link key={action.label} href={action.href}>
                      {inner}
                    </Link>
                  ) : (
                    <span key={action.label}>{inner}</span>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2.5">
                  <SectionIcon icon={ListChecks} tone="primary" />
                  <CardTitle>My tasks</CardTitle>
                </div>
                <Link href={`${base}/my-tasks`} className="text-xs font-medium text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {myTasks ? <MyTasksWidget tasks={myTasks} /> : <Skeleton className="h-40 w-full" />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center gap-2.5 space-y-0">
                <SectionIcon icon={Flag} tone="destructive" />
                <CardTitle>My workload by priority</CardTitle>
              </CardHeader>
              <CardContent>
                {myTasks ? <PriorityBreakdown tasks={myTasks} /> : <Skeleton className="h-40 w-full" />}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center gap-2.5 space-y-0">
                <SectionIcon icon={History} tone="muted" />
                <CardTitle>Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                {!data?.recentActivity.length && <p className="text-sm text-muted-foreground">Nothing yet — activity will show up here.</p>}
                <div className="relative space-y-1">
                  {data?.recentActivity.length ? (
                    <div className="absolute bottom-2 left-[13px] top-2 w-px bg-border" aria-hidden />
                  ) : null}
                  {data?.recentActivity.map((a) => (
                    <div key={a.id} className="relative flex items-start gap-3 rounded-xl px-1.5 py-2 transition-colors hover:bg-muted/40">
                      <ActivityIcon action={a.action} className="relative z-[1] ring-4 ring-card" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{a.actor.name}</span>{" "}
                          <span className="text-muted-foreground">{activityLabel(a.action)} a {a.entityType.toLowerCase()}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</p>
                      </div>
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={a.actor.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[10px]">{a.actor.name[0]}</AvatarFallback>
                      </Avatar>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <MiniCalendar
                    markedDates={[
                      ...(data?.upcomingDeadlines.map((t) => new Date(t.dueDate)) ?? []),
                      ...(data?.upcomingMeetings.map((m) => new Date(m.startTime)) ?? []),
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center gap-2.5 space-y-0">
                  <SectionIcon icon={CalendarDays} tone="amber" />
                  <CardTitle>Upcoming deadlines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!data?.upcomingDeadlines.length && <p className="text-sm text-muted-foreground">No deadlines this week.</p>}
                  {data?.upcomingDeadlines.map((t) => {
                    const daysAway = differenceInCalendarDays(new Date(t.dueDate), new Date());
                    const soon = daysAway <= 1;
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                      >
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", soon ? "bg-destructive" : "bg-primary")} />
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        <span className={cn("shrink-0 text-xs", soon ? "font-medium text-destructive" : "text-muted-foreground")}>
                          {format(new Date(t.dueDate), "MMM d")}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center gap-2.5 space-y-0">
                  <SectionIcon icon={Video} tone="blue" />
                  <CardTitle>Upcoming meetings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!data?.upcomingMeetings.length && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarClock className="h-4 w-4" />
                      Nothing scheduled
                    </div>
                  )}
                  {data?.upcomingMeetings.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-500">
                        <Video className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(m.startTime), "MMM d, h:mm a")}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <TaskDetailDialog />
    </>
  );
}
