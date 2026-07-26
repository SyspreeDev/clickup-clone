import { prisma } from "../../lib/prisma";
import { NotFoundError, ForbiddenError } from "../../lib/errors";
import { emitToChannel } from "../../sockets";
import { createNotification } from "../notifications/notification.service";
import type { CreateChannelInput, CreateMessageInput } from "@repo/shared-types";

const MESSAGE_INCLUDE = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  reactions: { include: { user: { select: { id: true, name: true } } } },
  attachments: true,
} as const;

export async function listChannels(workspaceId: string, userId: string) {
  return prisma.channel.findMany({
    where: { workspaceId, isArchived: false, members: { some: { userId } } },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createChannel(workspaceId: string, creatorId: string, input: CreateChannelInput) {
  const memberIds = new Set([creatorId, ...(input.memberIds ?? [])]);
  return prisma.channel.create({
    data: {
      workspaceId,
      name: input.name,
      type: input.type,
      topic: input.topic,
      createdById: creatorId,
      members: {
        create: Array.from(memberIds).map((userId) => ({
          userId,
          role: userId === creatorId ? "ADMIN" : "MEMBER",
        })),
      },
    },
    include: { members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } },
  });
}

export async function getOrCreateDm(workspaceId: string, userId: string, otherUserId: string) {
  const existing = await prisma.channel.findFirst({
    where: {
      workspaceId,
      type: "DM",
      members: { every: { userId: { in: [userId, otherUserId] } } },
      AND: [{ members: { some: { userId } } }, { members: { some: { userId: otherUserId } } }],
    },
    include: { members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } },
  });
  if (existing && existing.members.length === 2) return existing;

  return prisma.channel.create({
    data: {
      workspaceId,
      type: "DM",
      createdById: userId,
      members: { create: [{ userId, role: "ADMIN" }, { userId: otherUserId, role: "ADMIN" }] },
    },
    include: { members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } },
  });
}

async function assertMember(channelId: string, userId: string) {
  const member = await prisma.channelMember.findUnique({ where: { channelId_userId: { channelId, userId } } });
  if (!member) throw new ForbiddenError("Not a member of this channel");
  return member;
}

export async function listMessages(channelId: string, userId: string, cursor?: string) {
  await assertMember(channelId, userId);
  const messages = await prisma.message.findMany({
    where: { channelId, parentId: null },
    include: MESSAGE_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 50,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return messages.reverse();
}

export async function createMessage(channelId: string, authorId: string, input: CreateMessageInput) {
  await assertMember(channelId, authorId);

  const message = await prisma.message.create({
    data: { channelId, authorId, content: input.content, parentId: input.parentId },
    include: MESSAGE_INCLUDE,
  });

  const channel = await prisma.channel.findUniqueOrThrow({
    where: { id: channelId },
    include: { members: true },
  });

  emitToChannel(channelId, "message:new", message);

  for (const member of channel.members) {
    if (member.userId === authorId) continue;
    await createNotification({
      userId: member.userId,
      workspaceId: channel.workspaceId,
      type: "CHAT_MESSAGE",
      title: channel.type === "DM" ? `New message from ${message.author.name}` : `New message in #${channel.name}`,
      entityType: "Channel",
      entityId: channelId,
      actorId: authorId,
    });
  }

  return message;
}

export async function editMessage(id: string, authorId: string, content: string) {
  const message = await prisma.message.findUnique({ where: { id } });
  if (!message) throw new NotFoundError("Message not found");
  if (message.authorId !== authorId) throw new ForbiddenError("Cannot edit another user's message");

  const updated = await prisma.message.update({
    where: { id },
    data: { content, editedAt: new Date() },
    include: MESSAGE_INCLUDE,
  });
  emitToChannel(message.channelId, "message:updated", updated);
  return updated;
}

export async function deleteMessage(id: string, authorId: string) {
  const message = await prisma.message.findUnique({ where: { id } });
  if (!message) throw new NotFoundError("Message not found");
  if (message.authorId !== authorId) throw new ForbiddenError("Cannot delete another user's message");

  await prisma.message.update({ where: { id }, data: { isDeleted: true, content: "" } });
  emitToChannel(message.channelId, "message:deleted", { id });
}

export async function addReaction(messageId: string, userId: string, emoji: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new NotFoundError("Message not found");
  await assertMember(message.channelId, userId);

  await prisma.messageReaction.upsert({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
    update: {},
    create: { messageId, userId, emoji },
  });

  const updated = await prisma.message.findUnique({ where: { id: messageId }, include: MESSAGE_INCLUDE });
  emitToChannel(message.channelId, "message:reaction", updated);
  return updated;
}

export async function removeReaction(messageId: string, userId: string, emoji: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new NotFoundError("Message not found");

  await prisma.messageReaction.deleteMany({ where: { messageId, userId, emoji } });
  const updated = await prisma.message.findUnique({ where: { id: messageId }, include: MESSAGE_INCLUDE });
  emitToChannel(message.channelId, "message:reaction", updated);
  return updated;
}
