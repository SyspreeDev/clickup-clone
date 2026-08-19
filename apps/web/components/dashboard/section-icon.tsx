import { cn } from "@/lib/utils";

/**
 * Small icon used in front of a CardTitle so sections are easier to tell
 * apart at a glance. Neutral chip, colored icon — not a colored box. Color
 * fill on every icon everywhere is what read as "not clean"; a plain icon
 * with just a tint of color is the quieter, more sophisticated version of
 * the same idea.
 */
export function SectionIcon({
  icon: Icon,
  tone = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "destructive" | "muted" | "blue" | "amber";
}) {
  const toneClass = {
    primary: "text-primary",
    success: "text-success",
    destructive: "text-destructive",
    muted: "text-muted-foreground",
    blue: "text-blue-500",
    amber: "text-amber-500",
  }[tone];

  return (
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60", toneClass)}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}
