"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import {
  FolderKanban,
  Users2,
  CheckSquare,
  CircleCheck,
  Clock,
  Plus,
  CalendarClock,
  Activity as ActivityIcon,
} from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ProductivityChart } from "@/components/dashboard/productivity-chart";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { AiInsightsCard } from "@/components/dashboard/ai-insights-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/lib/queries/workspaces";
import { useCommandPaletteStore } from "@/stores/command-palette-store";

function activityLabel(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export default function WorkspaceDashboardPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const openPalette = useCommandPaletteStore((s) => s.open);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", workspaceId],
    queryFn: () => getDashboard(workspaceId),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const base = `/workspace/${workspaceId}`;

  return (
    <>
      <TopNav title="Dashboard" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-6xl space-y-6 p-6">
          {isLoading || !data ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard index={0} label="Active Projects" value={data.kpis.activeProjects} icon={FolderKanban} accent="primary" />
              <KpiCard index={1} label="Team Members" value={data.kpis.teamMembers} icon={Users2} accent="muted" />
              <KpiCard index={2} label="My Tasks" value={data.kpis.myTasks} icon={CheckSquare} accent="primary" />
              <KpiCard index={3} label="Completed" value={data.kpis.completedTasks} icon={CircleCheck} accent="success" />
              <KpiCard index={4} label="Pending" value={data.kpis.pendingTasks} icon={Clock} accent="destructive" />
              <KpiCard index={5} label="Notifications" value={data.kpis.unreadNotifications} icon={ActivityIcon} accent="muted" />
            </div>
          )}

          <AiInsightsCard />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Team productivity</CardTitle>
              </CardHeader>
              <CardContent>
                {data ? (
                  <ProductivityChart
                    completed={data.kpis.completedTasks}
                    pending={data.kpis.pendingTasks}
                    myTasks={data.kpis.myTasks}
                  />
                ) : (
                  <Skeleton className="h-64 w-full" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button variant="secondary" className="h-auto flex-col gap-1.5 py-3" onClick={() => openPalette()}>
                  <Plus className="h-4 w-4" />
                  <span className="text-xs">New task</span>
                </Button>
                <Link href={`${base}/projects/new`}>
                  <Button variant="secondary" className="h-auto w-full flex-col gap-1.5 py-3">
                    <FolderKanban className="h-4 w-4" />
                    <span className="text-xs">New project</span>
                  </Button>
                </Link>
                <Link href={`${base}/teams`}>
                  <Button variant="secondary" className="h-auto w-full flex-col gap-1.5 py-3">
                    <Users2 className="h-4 w-4" />
                    <span className="text-xs">Invite team</span>
                  </Button>
                </Link>
                <Link href={`${base}/meetings`}>
                  <Button variant="secondary" className="h-auto w-full flex-col gap-1.5 py-3">
                    <CalendarClock className="h-4 w-4" />
                    <span className="text-xs">Schedule meeting</span>
                  </Button>
                </Link>
                <Link href={`${base}/reports`}>
                  <Button variant="secondary" className="h-auto w-full flex-col gap-1.5 py-3">
                    <ActivityIcon className="h-4 w-4" />
                    <span className="text-xs">View reports</span>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!data?.recentActivity.length && <p className="text-sm text-muted-foreground">Nothing yet — activity will show up here.</p>}
                {data?.recentActivity.map((a) => (
                  <div key={a.id} className="flex items-start gap-3">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={a.actor.avatarUrl ?? undefined} />
                      <AvatarFallback>{a.actor.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{a.actor.name}</span>{" "}
                        <span className="text-muted-foreground">{activityLabel(a.action)} a {a.entityType.toLowerCase()}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</p>
                    </div>
                  </div>
                ))}
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
                <CardHeader>
                  <CardTitle>Upcoming deadlines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!data?.upcomingDeadlines.length && <p className="text-sm text-muted-foreground">No deadlines this week.</p>}
                  {data?.upcomingDeadlines.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{t.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{format(new Date(t.dueDate), "MMM d")}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Upcoming meetings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!data?.upcomingMeetings.length && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarClock className="h-4 w-4" />
                      Nothing scheduled
                    </div>
                  )}
                  {data?.upcomingMeetings.map((m) => (
                    <div key={m.id} className="text-sm">
                      <p className="font-medium">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(m.startTime), "MMM d, h:mm a")}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
