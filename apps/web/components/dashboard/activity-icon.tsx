import {
  Plus,
  Pencil,
  ArrowRightLeft,
  Flag,
  UserPlus,
  UserMinus,
  CalendarClock,
  MoveRight,
  MessageSquare,
  Paperclip,
  Link2,
  Link2Off,
  Archive,
  RotateCcw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CONFIG: Record<string, { icon: LucideIcon; className: string }> = {
  CREATED: { icon: Plus, className: "bg-success/10 text-success" },
  UPDATED: { icon: Pencil, className: "bg-muted text-muted-foreground" },
  STATUS_CHANGED: { icon: ArrowRightLeft, className: "bg-primary/10 text-primary" },
  PRIORITY_CHANGED: { icon: Flag, className: "bg-primary/10 text-primary" },
  ASSIGNED: { icon: UserPlus, className: "bg-primary/10 text-primary" },
  UNASSIGNED: { icon: UserMinus, className: "bg-muted text-muted-foreground" },
  DUE_DATE_CHANGED: { icon: CalendarClock, className: "bg-primary/10 text-primary" },
  MOVED: { icon: MoveRight, className: "bg-muted text-muted-foreground" },
  COMMENTED: { icon: MessageSquare, className: "bg-primary/10 text-primary" },
  ATTACHMENT_ADDED: { icon: Paperclip, className: "bg-muted text-muted-foreground" },
  ATTACHMENT_REMOVED: { icon: Paperclip, className: "bg-muted text-muted-foreground" },
  DEPENDENCY_ADDED: { icon: Link2, className: "bg-muted text-muted-foreground" },
  DEPENDENCY_REMOVED: { icon: Link2Off, className: "bg-muted text-muted-foreground" },
  ARCHIVED: { icon: Archive, className: "bg-muted text-muted-foreground" },
  RESTORED: { icon: RotateCcw, className: "bg-success/10 text-success" },
  DELETED: { icon: Trash2, className: "bg-destructive/10 text-destructive" },
};

export function ActivityIcon({ action, className }: { action: string; className?: string }) {
  const { icon: Icon, className: colorClass } = CONFIG[action] ?? CONFIG.UPDATED;
  return (
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", colorClass, className)}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}
