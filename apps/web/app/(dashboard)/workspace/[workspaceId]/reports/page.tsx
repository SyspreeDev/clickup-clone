"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Download } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getTeamProductivity,
  getProjectProgress,
  getWorkload,
  getTimeTracking,
  exportReport,
} from "@/lib/queries/reports";

export default function ReportsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);

  const { data: productivity, isLoading: loadingProductivity } = useQuery({
    queryKey: ["report", "team-productivity", workspaceId],
    queryFn: () => getTeamProductivity(workspaceId),
  });
  const { data: progress, isLoading: loadingProgress } = useQuery({
    queryKey: ["report", "project-progress", workspaceId],
    queryFn: () => getProjectProgress(workspaceId),
  });
  const { data: workload } = useQuery({
    queryKey: ["report", "workload", workspaceId],
    queryFn: () => getWorkload(workspaceId),
  });
  const { data: timeTracking } = useQuery({
    queryKey: ["report", "time-tracking", workspaceId],
    queryFn: () => getTimeTracking(workspaceId),
  });

  return (
    <>
      <TopNav title="Reports" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-5xl space-y-6 p-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Team productivity</CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportReport(workspaceId, "team-productivity")}>
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              {loadingProductivity ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productivity} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="assigned" name="Assigned" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" name="Completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Project progress</CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportReport(workspaceId, "project-progress")}>
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingProgress && <Skeleton className="h-32 w-full" />}
              {progress?.map((p) => (
                <div key={p.projectId}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {p.name} <span className="text-xs text-muted-foreground">{p.key}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.completed}/{p.total} ({p.percent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${p.percent}%` }} />
                  </div>
                </div>
              ))}
              {!loadingProgress && !progress?.length && <p className="text-sm text-muted-foreground">No projects yet.</p>}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Workload distribution</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => exportReport(workspaceId, "workload")}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {workload?.map((w) => (
                  <div key={w.userId} className="flex items-center justify-between text-sm">
                    <span>{w.name}</span>
                    <span className="font-medium">{w.activeTasks} active</span>
                  </div>
                ))}
                {!workload?.length && <p className="text-sm text-muted-foreground">No data yet.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Time tracking</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => exportReport(workspaceId, "time-tracking")}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {timeTracking?.map((t) => (
                  <div key={t.userId} className="flex items-center justify-between text-sm">
                    <span>{t.name}</span>
                    <span className="font-medium">{Math.round(t.minutes / 60)}h {t.minutes % 60}m</span>
                  </div>
                ))}
                {!timeTracking?.length && <p className="text-sm text-muted-foreground">No time logged yet.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
