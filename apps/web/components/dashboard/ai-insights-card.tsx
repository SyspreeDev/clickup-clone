"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function AiInsightsCard({ href }: { href: string }) {
  return (
    <Link href={href} className="block">
      <Card className="group relative overflow-hidden shadow-premium transition-transform hover:-translate-y-0.5">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: "radial-gradient(circle at 15% 20%, hsl(var(--primary) / 0.16), transparent 60%)" }}
        />
        <CardContent className="relative flex items-center gap-3 py-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/35 to-primary/10 text-primary ring-1 ring-inset ring-white/5">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Ask the AI assistant</p>
            <p className="text-xs text-muted-foreground">
              Get a project summary, draft a client email, or check what&apos;s overdue — in plain English.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </CardContent>
      </Card>
    </Link>
  );
}
