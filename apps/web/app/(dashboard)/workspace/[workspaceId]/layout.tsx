"use client";

import { use } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { TaskDetailDialog } from "@/components/task/task-detail-dialog";
import { useSocketSync } from "@/hooks/use-socket-sync";

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  useSocketSync(workspaceId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar workspaceId={workspaceId} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <CommandPalette workspaceId={workspaceId} />
      <TaskDetailDialog />
    </div>
  );
}
