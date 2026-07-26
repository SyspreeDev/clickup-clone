"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  index = 0,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "success" | "destructive" | "muted";
  index?: number;
}) {
  const accentClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  }[accent ?? "primary"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: "easeOut" }}
      className="rounded-2xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-soft-lg"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accentClass)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </motion.div>
  );
}
