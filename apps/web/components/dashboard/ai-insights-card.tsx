"use client";

import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function AiInsightsCard() {
  return (
    <Card className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(circle at 15% 20%, hsl(var(--primary) / 0.12), transparent 60%)" }}
      />
      <CardContent className="relative flex items-center gap-3 py-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">AI project insights</p>
          <p className="text-xs text-muted-foreground">Automatic summaries of task activity and project health.</p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Coming soon</span>
      </CardContent>
    </Card>
  );
}
