import { prisma } from "./prisma";
import { emitToWorkspace } from "../sockets";
import type { ActivityAction } from "@prisma/client";

interface LogActivityInput {
  workspaceId: string;
  projectId?: string;
  taskId?: string;
  actorId: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(input: LogActivityInput) {
  const entry = await prisma.activityLog.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      taskId: input.taskId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata as never,
    },
    include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
  });

  // Broadcast to the whole workspace, not just the list's own room — the dashboard,
  // "My Tasks", and "Clients" views all show activity across lists nobody joins a
  // room for individually, and every client already joins its workspace room.
  emitToWorkspace(input.workspaceId, "activity:new", entry);
  return entry;
}
