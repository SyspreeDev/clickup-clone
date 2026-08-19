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
  // Solid-ish gradient chips (not faint tints) with a foreground-colored icon —
  // this is what reads as "rich" rather than merely "dark mode with a hint of color".
  const accentClass = {
    primary: "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_4px_14px_-2px_hsl(var(--primary)/0.5)]",
    success: "bg-gradient-to-br from-success to-success/70 text-success-foreground shadow-[0_4px_14px_-2px_hsl(var(--success)/0.5)]",
    destructive:
      "bg-gradient-to-br from-destructive to-destructive/70 text-destructive-foreground shadow-[0_4px_14px_-2px_hsl(var(--destructive)/0.5)]",
    muted: "bg-gradient-to-br from-muted-foreground/40 to-muted-foreground/20 text-foreground",
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
        "group rounded-2xl border border-border bg-card p-5 shadow-soft ring-1 ring-transparent transition-all hover:shadow-premium",
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
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-full transition-transform group-hover:scale-105", accentClass)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p>
    </motion.div>
  );

  if (!href) return content;
  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}
