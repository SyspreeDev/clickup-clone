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
  // Small, quiet rounded-square chips — a flat-ish gradient and a restrained
  // shadow read as sophisticated; a glow ring reads as a toy. Match the icon
  // treatment to plain product UI (Linear/Vercel-style), not a marketing site.
  const accentClass = {
    primary: "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
    success: "bg-gradient-to-br from-success to-success/80 text-success-foreground",
    destructive: "bg-gradient-to-br from-destructive to-destructive/80 text-destructive-foreground",
    muted: "bg-muted text-muted-foreground",
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
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accentClass)}>
          <Icon className="h-4 w-4" />
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
