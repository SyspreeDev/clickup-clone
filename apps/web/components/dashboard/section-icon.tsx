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
    primary: "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
    success: "bg-gradient-to-br from-success to-success/80 text-success-foreground",
    destructive: "bg-gradient-to-br from-destructive to-destructive/80 text-destructive-foreground",
    muted: "bg-muted text-muted-foreground",
    blue: "bg-gradient-to-br from-blue-500 to-blue-600 text-white",
    amber: "bg-gradient-to-br from-amber-400 to-amber-600 text-white",
  }[tone];

  return (
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", toneClass)}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}
