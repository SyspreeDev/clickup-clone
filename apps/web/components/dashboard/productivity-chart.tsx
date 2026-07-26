"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ProductivityChart({
  completed,
  pending,
  myTasks,
}: {
  completed: number;
  pending: number;
  myTasks: number;
}) {
  const data = [
    { name: "Completed", value: completed, fill: "hsl(var(--success))" },
    { name: "Pending", value: pending, fill: "hsl(var(--primary))" },
    { name: "Assigned to me", value: myTasks, fill: "hsl(var(--muted-foreground))" },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
