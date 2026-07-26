import { prisma } from "./prisma";
import { emitToProject } from "../sockets";
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

  if (input.projectId) {
    emitToProject(input.projectId, "activity:new", entry);
  }
  return entry;
}
