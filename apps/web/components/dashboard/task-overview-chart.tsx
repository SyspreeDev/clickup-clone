"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

const EMPTY = [{ name: "Empty", value: 1 }];

/** Donut completion ring + a small legend — replaces a 3-bar chart that mixed team-wide and personal counts into one confusing view. */
export function TaskOverviewChart({ completed, pending }: { completed: number; pending: number }) {
  const total = completed + pending;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const hasData = total > 0;

  const rows = [
    { label: "Completed", value: completed, dot: "bg-success", fill: "hsl(var(--success))" },
    { label: "Pending", value: pending, dot: "bg-primary", fill: "hsl(var(--primary))" },
  ];

  return (
    <div className="flex flex-col items-center gap-8 py-2 sm:flex-row sm:justify-center">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={hasData ? rows : EMPTY}
              dataKey="value"
              innerRadius="72%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              stroke="none"
              paddingAngle={hasData ? 4 : 0}
              isAnimationActive
            >
              {hasData ? (
                rows.map((r) => <Cell key={r.label} fill={r.fill} />)
              ) : (
                <Cell fill="hsl(var(--muted))" />
              )}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-tight">{rate}%</span>
          <span className="text-[11px] text-muted-foreground">completed</span>
        </div>
      </div>

      <div className="w-full max-w-[220px] space-y-2.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5"
          >
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", row.dot)} />
            <span className="flex-1 text-sm text-muted-foreground">{row.label}</span>
            <span className="text-sm font-semibold tabular-nums">{row.value}</span>
          </div>
        ))}
        {!hasData && (
          <p className="px-1 pt-1 text-xs text-muted-foreground">No tasks yet — this fills in as work gets tracked.</p>
        )}
      </div>
    </div>
  );
}
