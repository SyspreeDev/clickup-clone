import { prisma } from "../../lib/prisma";
import { emitToUser } from "../../sockets";
import type { NotificationType } from "@prisma/client";

interface CreateNotificationInput {
  userId: string;
  workspaceId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
}

export async function createNotification(input: CreateNotificationInput) {
  if (input.actorId === input.userId) return null; // don't notify users about their own actions
  const notification = await prisma.notification.create({ data: input });
  emitToUser(input.userId, "notification:new", notification);
  return notification;
}

export async function listNotifications(userId: string, unreadOnly: boolean) {
  return prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markRead(userId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true, readAt: new Date() } });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
}

export async function remove(userId: string, id: string) {
  await prisma.notification.deleteMany({ where: { id, userId } });
}
