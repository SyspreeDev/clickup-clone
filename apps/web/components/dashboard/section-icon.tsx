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
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
    blue: "bg-blue-500/10 text-blue-500",
    amber: "bg-amber-500/10 text-amber-500",
  }[tone];

  return (
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", toneClass)}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}
