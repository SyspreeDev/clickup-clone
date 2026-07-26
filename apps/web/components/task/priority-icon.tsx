import { Minus, SignalLow, SignalMedium, SignalHigh, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskSummary } from "@/lib/queries/tasks";

const CONFIG: Record<TaskSummary["priority"], { icon: React.ComponentType<{ className?: string }>; className: string; label: string }> = {
  NO_PRIORITY: { icon: Minus, className: "text-muted-foreground", label: "No priority" },
  LOW: { icon: SignalLow, className: "text-blue-500", label: "Low" },
  MEDIUM: { icon: SignalMedium, className: "text-amber-500", label: "Medium" },
  HIGH: { icon: SignalHigh, className: "text-orange-500", label: "High" },
  URGENT: { icon: AlertTriangle, className: "text-red-500", label: "Urgent" },
};

export function PriorityIcon({ priority, className }: { priority: TaskSummary["priority"]; className?: string }) {
  const { icon: Icon, className: colorClass } = CONFIG[priority];
  return <Icon className={cn("h-3.5 w-3.5", colorClass, className)} />;
}

export function priorityLabel(priority: TaskSummary["priority"]) {
  return CONFIG[priority].label;
}

export const PRIORITY_CONFIG = CONFIG;
