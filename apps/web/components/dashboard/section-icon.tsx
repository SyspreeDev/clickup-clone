import { cn } from "@/lib/utils";

/** Small colored icon badge used in front of a CardTitle so sections are easier to tell apart at a glance. */
export function SectionIcon({
  icon: Icon,
  tone = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "destructive" | "muted" | "blue" | "amber";
}) {
  const toneClass = {
    primary: "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_3px_10px_-2px_hsl(var(--primary)/0.55)]",
    success: "bg-gradient-to-br from-success to-success/70 text-success-foreground shadow-[0_3px_10px_-2px_hsl(var(--success)/0.55)]",
    destructive:
      "bg-gradient-to-br from-destructive to-destructive/70 text-destructive-foreground shadow-[0_3px_10px_-2px_hsl(var(--destructive)/0.55)]",
    muted: "bg-gradient-to-br from-muted-foreground/40 to-muted-foreground/20 text-foreground",
    blue: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_3px_10px_-2px_rgb(59_130_246/0.55)]",
    amber: "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_3px_10px_-2px_rgb(217_119_6/0.55)]",
  }[tone];

  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-white/10", toneClass)}>
      <Icon className="h-4 w-4" />
    </span>
  );
}
