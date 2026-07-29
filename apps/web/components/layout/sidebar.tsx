"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  CheckSquare,
  Users2,
  MessagesSquare,
  FileText,
  BarChart3,
  CalendarClock,
  Settings,
  Plus,
  ChevronRight,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { SidebarTree } from "@/components/layout/sidebar-tree";
import { listTree } from "@/lib/queries/hierarchy";
import { useAuthStore } from "@/stores/auth-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { logout as logoutRequest } from "@/lib/queries/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-border/60 hover:text-sidebar-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const isMobileOpen = useSidebarStore((s) => s.isMobileOpen);
  const closeMobile = useSidebarStore((s) => s.close);

  // Spaces → folders → lists, already access-filtered by the API.
  const { data: spaces } = useQuery({
    queryKey: ["tree", workspaceId],
    queryFn: () => listTree(workspaceId),
  });

  // Reports aggregate company-wide data and are ADMIN-only server-side, so don't
  // show members a link that can only ever return 403.
  const workspaceRole = user?.workspaces?.find((w) => w.id === workspaceId)?.role;
  const isManager = workspaceRole === "OWNER" || workspaceRole === "ADMIN";

  const base = `/workspace/${workspaceId}`;
  const nav = [
    { href: base, icon: LayoutDashboard, label: "Dashboard" },
    { href: `${base}/my-tasks`, icon: CheckSquare, label: "My Tasks" },
    { href: `${base}/teams`, icon: Users2, label: "Spaces" },
    { href: `${base}/chat`, icon: MessagesSquare, label: "Chat" },
    { href: `${base}/meetings`, icon: CalendarClock, label: "Meetings" },
    { href: `${base}/files`, icon: FileText, label: "Files" },
    ...(isManager ? [{ href: `${base}/reports`, icon: BarChart3, label: "Reports" }] : []),
  ];

  async function handleLogout() {
    await logoutRequest().catch(() => null);
    clear();
    router.push("/login");
  }

  return (
    <>
      {isMobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={closeMobile} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
      <div className="p-2">
        <WorkspaceSwitcher currentWorkspaceId={workspaceId} />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-2 pb-4 scrollbar-thin">
        <nav className="space-y-0.5" onClick={closeMobile}>
          {nav.map((item) => (
            <NavLink key={item.href} {...item} active={pathname === item.href} />
          ))}
        </nav>

        <div>
          <div className="flex items-center justify-between px-2.5 py-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spaces</span>
            <button
              onClick={() => router.push(`${base}/projects/new`)}
              className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-border/60 hover:text-sidebar-foreground"
              aria-label="Create list"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <SidebarTree spaces={spaces} base={base} onNavigate={closeMobile} />
        </div>
      </div>

      <div className="border-t border-sidebar-border p-2">
        <NavLink href={`${base}/settings/workspace`} icon={Settings} label="Settings" active={pathname?.startsWith(`${base}/settings`) ?? false} />
        <DropdownMenu>
          <DropdownMenuTrigger className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-sidebar-border/60 focus:outline-none">
            <Avatar className="h-7 w-7">
              <AvatarImage src={user?.avatarUrl ?? undefined} />
              <AvatarFallback>{user?.name?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuItem onClick={() => router.push(`${base}/settings/profile`)}>
              <UserIcon className="h-4 w-4" />
              Profile settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </aside>
    </>
  );
}
