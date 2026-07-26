import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";
import { emitToProject } from "../../sockets";
import type { CreateChecklistInput, CreateChecklistItemInput, UpdateChecklistItemInput } from "@repo/shared-types";

async function taskProjectId(taskId: string): Promise<string> {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) throw new NotFoundError("Task not found");
  return task.projectId;
}

async function emitTaskUpdated(taskId: string) {
  const projectId = await taskProjectId(taskId);
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { checklists: { include: { items: { orderBy: { position: "asc" } } }, orderBy: { position: "asc" } } },
  });
  emitToProject(projectId, "task:updated", task);
}

export async function createChecklist(taskId: string, input: CreateChecklistInput) {
  const last = await prisma.checklist.findFirst({ where: { taskId }, orderBy: { position: "desc" } });
  const checklist = await prisma.checklist.create({
    data: { taskId, title: input.title, position: (last?.position ?? 0) + 1000 },
    include: { items: true },
  });
  await emitTaskUpdated(taskId);
  return checklist;
}

export async function updateChecklist(id: string, title: string) {
  const checklist = await prisma.checklist.update({ where: { id }, data: { title } });
  await emitTaskUpdated(checklist.taskId);
  return checklist;
}

export async function deleteChecklist(id: string) {
  const checklist = await prisma.checklist.findUnique({ where: { id } });
  if (!checklist) throw new NotFoundError("Checklist not found");
  await prisma.checklist.delete({ where: { id } });
  await emitTaskUpdated(checklist.taskId);
}

export async function addItem(checklistId: string, input: CreateChecklistItemInput) {
  const checklist = await prisma.checklist.findUnique({ where: { id: checklistId } });
  if (!checklist) throw new NotFoundError("Checklist not found");

  const last = await prisma.checklistItem.findFirst({ where: { checklistId }, orderBy: { position: "desc" } });
  const item = await prisma.checklistItem.create({
    data: { checklistId, title: input.title, assigneeId: input.assigneeId, position: (last?.position ?? 0) + 1000 },
  });
  await emitTaskUpdated(checklist.taskId);
  return item;
}

export async function updateItem(id: string, input: UpdateChecklistItemInput) {
  const item = await prisma.checklistItem.findUnique({ where: { id }, include: { checklist: true } });
  if (!item) throw new NotFoundError("Checklist item not found");

  const updated = await prisma.checklistItem.update({
    where: { id },
    data: {
      ...input,
      completedAt: input.isCompleted === undefined ? undefined : input.isCompleted ? new Date() : null,
    },
  });
  await emitTaskUpdated(item.checklist.taskId);
  return updated;
}

export async function deleteItem(id: string) {
  const item = await prisma.checklistItem.findUnique({ where: { id }, include: { checklist: true } });
  if (!item) throw new NotFoundError("Checklist item not found");
  await prisma.checklistItem.delete({ where: { id } });
  await emitTaskUpdated(item.checklist.taskId);
}
