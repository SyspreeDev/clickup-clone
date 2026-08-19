"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  accent,
  index = 0,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  /** No longer rendered — kept optional so existing call sites don't need to change. */
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "success" | "destructive" | "muted";
  index?: number;
  /** Plain-language explanation of what this number means — shown on hover so the card is self-explanatory. */
  hint?: string;
  href?: string;
}) {
  // No icon, no colored box — just the label, the number, and a plain color
  // cue (a small dot, the way a status light works) for at-a-glance meaning.
  // This is what actually reads as clean: quiet cards, color used sparingly.
  const dotClass = {
    primary: "bg-primary",
    success: "bg-success",
    destructive: "bg-destructive",
    muted: "bg-muted-foreground/40",
  }[accent ?? "primary"];

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className={cn(
        "group rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:shadow-soft-lg",
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
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} />
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
    </motion.div>
  );

  if (!href) return content;
  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}
