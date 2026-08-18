"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  index = 0,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "success" | "destructive" | "muted";
  index?: number;
  /** Plain-language explanation of what this number means — shown on hover so the card is self-explanatory. */
  hint?: string;
  href?: string;
}) {
  const accentClass = {
    primary: "bg-gradient-to-br from-primary/25 to-primary/10 text-primary",
    success: "bg-gradient-to-br from-success/25 to-success/10 text-success",
    destructive: "bg-gradient-to-br from-destructive/25 to-destructive/10 text-destructive",
    muted: "bg-gradient-to-br from-muted-foreground/15 to-muted-foreground/5 text-muted-foreground",
  }[accent ?? "primary"];

  const ringClass = {
    primary: "group-hover:ring-primary/20",
    success: "group-hover:ring-success/20",
    destructive: "group-hover:ring-destructive/20",
    muted: "group-hover:ring-muted-foreground/15",
  }[accent ?? "primary"];

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className={cn(
        "group rounded-2xl border border-border bg-card p-4 shadow-soft ring-1 ring-transparent transition-all hover:shadow-soft-lg",
        ringClass,
        href && "cursor-pointer",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          {label}
          {hint && (
            <span title={hint}>
              <Info className="h-3 w-3 opacity-60" />
            </span>
          )}
        </span>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-105", accentClass)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
    </motion.div>
  );

  if (!href) return content;
  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}
