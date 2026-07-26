import { prisma } from "../../lib/prisma";
import { NotFoundError, BadRequestError } from "../../lib/errors";
import { logActivity } from "../../lib/activity";
import { createNotification } from "../notifications/notification.service";
import { emitToProject } from "../../sockets";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
  TaskFilterInput,
  CreateDependencyInput,
  CreateTimeEntryInput,
} from "@repo/shared-types";

const TASK_INCLUDE = {
  assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
  taskLabels: { include: { label: true } },
  workflowState: true,
  milestone: true,
  _count: { select: { subtasks: true, comments: true, attachments: true, checklists: true } },
} as const;

async function nextTaskNumber(projectId: string): Promise<number> {
  const last = await prisma.task.findFirst({ where: { projectId }, orderBy: { number: "desc" } });
  return (last?.number ?? 0) + 1;
}

async function nextPosition(projectId: string, workflowStateId: string): Promise<number> {
  const last = await prisma.task.findFirst({
    where: { projectId, workflowStateId },
    orderBy: { position: "desc" },
  });
  return (last?.position ?? 0) + 1000;
}

export async function listTasks(projectId: string, filters: TaskFilterInput) {
  return prisma.task.findMany({
    where: {
      projectId,
      parentId: null,
      isArchived: filters.includeArchived ? undefined : false,
      ...(filters.workflowStateId ? { workflowStateId: filters.workflowStateId } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.assigneeId ? { assignees: { some: { userId: filters.assigneeId } } } : {}),
      ...(filters.labelId ? { taskLabels: { some: { labelId: filters.labelId } } } : {}),
      ...(filters.q ? { title: { contains: filters.q, mode: "insensitive" } } : {}),
    },
    include: TASK_INCLUDE,
    orderBy: { position: "asc" },
  });
}

export async function getTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      ...TASK_INCLUDE,
      project: { select: { id: true, name: true, key: true, workspaceId: true } },
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      subtasks: { include: TASK_INCLUDE, orderBy: { position: "asc" } },
      checklists: { include: { items: { orderBy: { position: "asc" } } }, orderBy: { position: "asc" } },
      dependencies: { include: { dependsOn: { select: { id: true, title: true, number: true } } } },
      dependents: { include: { task: { select: { id: true, title: true, number: true } } } },
      comments: {
        where: { parentId: null },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          replies: { include: { author: { select: { id: true, name: true, avatarUrl: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
      timeEntries: { include: { user: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { startedAt: "desc" } },
    },
  });
  if (!task) throw new NotFoundError("Task not found");
  return task;
}

export async function createTask(projectId: string, creatorId: string, input: CreateTaskInput) {
  const [number, position] = await Promise.all([
    nextTaskNumber(projectId),
    nextPosition(projectId, input.workflowStateId),
  ]);

  const task = await prisma.task.create({
    data: {
      projectId,
      number,
      position,
      workflowStateId: input.workflowStateId,
      parentId: input.parentId,
      milestoneId: input.milestoneId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      startDate: input.startDate,
      dueDate: input.dueDate,
      estimateMinutes: input.estimateMinutes,
      createdById: creatorId,
      assignees: input.assigneeIds?.length
        ? { create: input.assigneeIds.map((userId) => ({ userId })) }
        : undefined,
      taskLabels: input.labelIds?.length
        ? { create: input.labelIds.map((labelId) => ({ labelId })) }
        : undefined,
    },
    include: TASK_INCLUDE,
  });

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  await logActivity({
    workspaceId: project.workspaceId,
    projectId,
    taskId: task.id,
    actorId: creatorId,
    action: "CREATED",
    entityType: "Task",
    entityId: task.id,
  });

  for (const userId of input.assigneeIds ?? []) {
    await createNotification({
      userId,
      workspaceId: project.workspaceId,
      type: "TASK_ASSIGNED",
      title: `You were assigned to "${task.title}"`,
      entityType: "Task",
      entityId: task.id,
      actorId: creatorId,
    });
  }

  emitToProject(projectId, "task:created", task);
  return task;
}

export async function updateTask(taskId: string, input: UpdateTaskInput, actorId: string) {
  const existing = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!existing) throw new NotFoundError("Task not found");

  const workflowState = existing.workflowStateId
    ? await prisma.workflowState.findUnique({ where: { id: existing.workflowStateId } })
    : null;
  const wasCompleted = workflowState?.category === "COMPLETED";

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...input,
      completedAt: input.isArchived === undefined ? existing.completedAt : existing.completedAt,
    },
    include: TASK_INCLUDE,
  });

  await logActivity({
    workspaceId: existing.project.workspaceId,
    projectId: existing.projectId,
    taskId,
    actorId,
    action: "UPDATED",
    entityType: "Task",
    entityId: taskId,
    metadata: input as Record<string, unknown>,
  });

  if (!wasCompleted && workflowState?.category === "COMPLETED") {
    // handled in moveTask; left here for direct-update edge cases
  }

  emitToProject(existing.projectId, "task:updated", task);
  return task;
}

export async function moveTask(taskId: string, input: MoveTaskInput, actorId: string) {
  const existing = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!existing) throw new NotFoundError("Task not found");

  const newState = await prisma.workflowState.findUnique({ where: { id: input.workflowStateId } });
  if (!newState || newState.projectId !== existing.projectId) {
    throw new BadRequestError("Workflow state does not belong to this project");
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      workflowStateId: input.workflowStateId,
      position: input.position,
      completedAt: newState.category === "COMPLETED" ? new Date() : null,
    },
    include: TASK_INCLUDE,
  });

  await logActivity({
    workspaceId: existing.project.workspaceId,
    projectId: existing.projectId,
    taskId,
    actorId,
    action: "MOVED",
    entityType: "Task",
    entityId: taskId,
    metadata: { toWorkflowStateId: input.workflowStateId },
  });

  if (newState.category === "COMPLETED") {
    for (const assignee of await prisma.taskAssignee.findMany({ where: { taskId } })) {
      await createNotification({
        userId: assignee.userId,
        workspaceId: existing.project.workspaceId,
        type: "TASK_COMPLETED",
        title: `"${task.title}" was marked complete`,
        entityType: "Task",
        entityId: taskId,
        actorId,
      });
    }
  }

  emitToProject(existing.projectId, "task:moved", task);
  return task;
}

export async function deleteTask(taskId: string) {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new NotFoundError("Task not found");
  await prisma.task.delete({ where: { id: taskId } });
  emitToProject(existing.projectId, "task:deleted", { id: taskId });
}

export async function addAssignee(taskId: string, userId: string, actorId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) throw new NotFoundError("Task not found");

  await prisma.taskAssignee.upsert({
    where: { taskId_userId: { taskId, userId } },
    update: {},
    create: { taskId, userId },
  });

  await logActivity({
    workspaceId: task.project.workspaceId,
    projectId: task.projectId,
    taskId,
    actorId,
    action: "ASSIGNED",
    entityType: "Task",
    entityId: taskId,
    metadata: { userId },
  });

  await createNotification({
    userId,
    workspaceId: task.project.workspaceId,
    type: "TASK_ASSIGNED",
    title: `You were assigned to "${task.title}"`,
    entityType: "Task",
    entityId: taskId,
    actorId,
  });

  const updated = await getTask(taskId);
  emitToProject(task.projectId, "task:updated", updated);
  return updated;
}

export async function removeAssignee(taskId: string, userId: string, actorId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) throw new NotFoundError("Task not found");

  await prisma.taskAssignee.delete({ where: { taskId_userId: { taskId, userId } } }).catch(() => null);

  await logActivity({
    workspaceId: task.project.workspaceId,
    projectId: task.projectId,
    taskId,
    actorId,
    action: "UNASSIGNED",
    entityType: "Task",
    entityId: taskId,
    metadata: { userId },
  });

  const updated = await getTask(taskId);
  emitToProject(task.projectId, "task:updated", updated);
  return updated;
}

export async function addLabel(taskId: string, labelId: string) {
  await prisma.taskLabel.upsert({
    where: { taskId_labelId: { taskId, labelId } },
    update: {},
    create: { taskId, labelId },
  });
  return getTask(taskId);
}

export async function removeLabel(taskId: string, labelId: string) {
  await prisma.taskLabel.delete({ where: { taskId_labelId: { taskId, labelId } } }).catch(() => null);
  return getTask(taskId);
}

export async function listSubtasks(taskId: string) {
  return prisma.task.findMany({ where: { parentId: taskId }, include: TASK_INCLUDE, orderBy: { position: "asc" } });
}

export async function createSubtask(parentId: string, creatorId: string, input: CreateTaskInput) {
  const parent = await prisma.task.findUnique({ where: { id: parentId } });
  if (!parent) throw new NotFoundError("Parent task not found");
  return createTask(parent.projectId, creatorId, { ...input, parentId });
}

export async function addDependency(taskId: string, input: CreateDependencyInput, actorId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) throw new NotFoundError("Task not found");
  if (taskId === input.dependsOnId) throw new BadRequestError("A task cannot depend on itself");

  const dependency = await prisma.taskDependency.create({
    data: { taskId, dependsOnId: input.dependsOnId, type: input.type },
  });

  await logActivity({
    workspaceId: task.project.workspaceId,
    projectId: task.projectId,
    taskId,
    actorId,
    action: "DEPENDENCY_ADDED",
    entityType: "Task",
    entityId: taskId,
    metadata: { dependsOnId: input.dependsOnId },
  });

  return dependency;
}

export async function removeDependency(dependencyId: string) {
  await prisma.taskDependency.delete({ where: { id: dependencyId } });
}

export async function listActivity(taskId: string) {
  return prisma.activityLog.findMany({
    where: { taskId },
    include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listTimeEntries(taskId: string) {
  return prisma.timeEntry.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { startedAt: "desc" },
  });
}

export async function createTimeEntry(taskId: string, userId: string, input: CreateTimeEntryInput) {
  const durationMinutes =
    input.durationMinutes ??
    (input.endedAt ? Math.round((input.endedAt.getTime() - input.startedAt.getTime()) / 60000) : undefined);

  return prisma.timeEntry.create({
    data: { taskId, userId, ...input, durationMinutes },
  });
}

export async function deleteTimeEntry(id: string) {
  await prisma.timeEntry.delete({ where: { id } });
}

export async function listMyTasks(userId: string, workspaceId?: string) {
  return prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      isArchived: false,
      ...(workspaceId ? { project: { workspaceId } } : {}),
    },
    include: {
      ...TASK_INCLUDE,
      project: { select: { id: true, name: true, key: true } },
    },
    orderBy: { dueDate: "asc" },
  });
}
