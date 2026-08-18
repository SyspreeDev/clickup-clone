import { prisma } from "../../lib/prisma";
import { NotFoundError, ForbiddenError } from "../../lib/errors";
import { logActivity } from "../../lib/activity";
import { createNotification } from "../notifications/notification.service";
import { emitToWorkspace } from "../../sockets";
import type { CreateCommentInput } from "@repo/shared-types";

const COMMENT_INCLUDE = {
  author: { select: { id: true, name: true, avatarUrl: true } },
} as const;

export async function createComment(taskId: string, authorId: string, input: CreateCommentInput) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) throw new NotFoundError("Task not found");

  const comment = await prisma.comment.create({
    data: {
      taskId,
      authorId,
      content: input.content,
      parentId: input.parentId,
      mentions: input.mentionedUserIds?.length
        ? { create: input.mentionedUserIds.map((mentionedUserId) => ({ mentionedUserId })) }
        : undefined,
    },
    include: COMMENT_INCLUDE,
  });

  await logActivity({
    workspaceId: task.project.workspaceId,
    projectId: task.projectId,
    taskId,
    actorId: authorId,
    action: "COMMENTED",
    entityType: "Comment",
    entityId: comment.id,
  });

  const assignees = await prisma.taskAssignee.findMany({ where: { taskId } });
  for (const a of assignees) {
    await createNotification({
      userId: a.userId,
      workspaceId: task.project.workspaceId,
      type: "TASK_COMMENTED",
      title: `New comment on "${task.title}"`,
      entityType: "Task",
      entityId: taskId,
      actorId: authorId,
    });
  }

  for (const userId of input.mentionedUserIds ?? []) {
    await createNotification({
      userId,
      workspaceId: task.project.workspaceId,
      type: "MENTIONED",
      title: `You were mentioned on "${task.title}"`,
      entityType: "Task",
      entityId: taskId,
      actorId: authorId,
    });
  }

  emitToWorkspace(task.project.workspaceId, "comment:created", comment);
  return comment;
}

export async function updateComment(id: string, authorId: string, content: unknown) {
  const comment = await prisma.comment.findUnique({ where: { id }, include: { task: { include: { project: true } } } });
  if (!comment) throw new NotFoundError("Comment not found");
  if (comment.authorId !== authorId) throw new ForbiddenError("Cannot edit another user's comment");

  const updated = await prisma.comment.update({
    where: { id },
    data: { content: content as never, editedAt: new Date() },
    include: COMMENT_INCLUDE,
  });
  emitToWorkspace(comment.task.project.workspaceId, "comment:updated", updated);
  return updated;
}

export async function deleteComment(id: string, authorId: string) {
  const comment = await prisma.comment.findUnique({ where: { id }, include: { task: { include: { project: true } } } });
  if (!comment) throw new NotFoundError("Comment not found");
  if (comment.authorId !== authorId) throw new ForbiddenError("Cannot delete another user's comment");

  await prisma.comment.update({ where: { id }, data: { isDeleted: true, content: {} } });
  emitToWorkspace(comment.task.project.workspaceId, "comment:updated", { id, isDeleted: true });
}
