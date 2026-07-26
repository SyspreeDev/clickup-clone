"use client";

import { Search, Plus, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useSidebarStore } from "@/stores/sidebar-store";

export function TopNav({ title }: { title?: string }) {
  const open = useCommandPaletteStore((s) => s.open);
  const openSidebar = useSidebarStore((s) => s.open);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={openSidebar} aria-label="Open menu">
          <Menu className="h-4 w-4" />
        </Button>
        {title && <h1 className="truncate text-sm font-semibold text-foreground">{title}</h1>}
      </div>
      <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
        <button
          onClick={open}
          className="hidden items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent sm:flex sm:w-full sm:max-w-xs"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
        </button>
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={open} aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>
        <Button size="sm" className="hidden gap-1.5 sm:flex" onClick={open}>
          <Plus className="h-3.5 w-3.5" />
          Quick create
        </Button>
        <Button size="icon" className="sm:hidden" onClick={open} aria-label="Quick create">
          <Plus className="h-4 w-4" />
        </Button>
        <NotificationBell />
        <ThemeToggle />
      </div>
    </header>
  );
}
