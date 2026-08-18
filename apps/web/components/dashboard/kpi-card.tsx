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
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  }[accent ?? "primary"];

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: "easeOut" }}
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-soft-lg",
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
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accentClass)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </motion.div>
  );

  if (!href) return content;
  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}
