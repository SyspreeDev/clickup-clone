import { prisma } from "../../lib/prisma";
import { storageProvider } from "../../lib/storage";
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from "../../lib/errors";
import { resolveProjectRole } from "../../lib/access";
import { logActivity } from "../../lib/activity";
import { createNotification } from "../notifications/notification.service";
import { emitToWorkspace } from "../../sockets";
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
      // workflowState comes along so the UI can say whether a blocker is actually
      // finished, rather than just naming it.
      dependencies: {
        include: { dependsOn: { select: { id: true, title: true, number: true, workflowState: true } } },
      },
      dependents: { include: { task: { select: { id: true, title: true, number: true, workflowState: true } } } },
      comments: {
        where: { parentId: null },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          replies: { include: { author: { select: { id: true, name: true, avatarUrl: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
      timeEntries: { include: { user: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { startedAt: "desc" } },
      attachments: {
        include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!task) throw new NotFoundError("Task not found");
  return task;
}

/**
 * Files dropped on a task are stored twice over: as an Attachment on the task,
 * and as a File carrying the list's projectId — so the same upload also shows up
 * under that client in the workspace Files area, which is the whole point of
 * organising uploads per client.
 */
export async function addAttachment(
  taskId: string,
  uploaderId: string,
  file: { originalname: string; buffer: Buffer; size: number; mimetype: string },
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, title: true, project: { select: { workspaceId: true } } },
  });
  if (!task) throw new NotFoundError("Task not found");

  const stored = await storageProvider.save(file.originalname, file.buffer);

  const record = await prisma.file.create({
    data: {
      workspaceId: task.project.workspaceId,
      projectId: task.projectId,
      name: file.originalname,
      url: stored.url,
      size: file.size,
      mimeType: file.mimetype,
      uploadedById: uploaderId,
    },
  });

  const attachment = await prisma.attachment.create({
    data: {
      taskId,
      fileId: record.id,
      fileName: file.originalname,
      fileUrl: stored.url,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedById: uploaderId,
    },
    include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
  });

  await logActivity({
    workspaceId: task.project.workspaceId,
    projectId: task.projectId,
    taskId,
    actorId: uploaderId,
    action: "ATTACHMENT_ADDED",
    entityType: "Attachment",
    entityId: attachment.id,
    metadata: { fileName: file.originalname },
  });

  emitToWorkspace(task.project.workspaceId, "task:updated", await getTask(taskId));
  return attachment;
}

/** Direct-to-storage upload, step 1 — see file.service.ts presignUpload for the full explanation. */
export async function presignAttachmentUpload(originalName: string, contentType: string) {
  if (!storageProvider.presignUpload) return null;
  return storageProvider.presignUpload(originalName, contentType);
}

/**
 * Direct-to-storage upload, step 2: the browser already PUT the bytes, so
 * this just records the Attachment (and its mirrored File row) — mirrors
 * addAttachment above minus the storageProvider.save call.
 */
export async function completeAttachmentUpload(
  taskId: string,
  uploaderId: string,
  input: { key: string; name: string; size: number; mimeType: string },
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, title: true, project: { select: { workspaceId: true } } },
  });
  if (!task) throw new NotFoundError("Task not found");

  const url = storageProvider.resolveUrl(input.key);

  const record = await prisma.file.create({
    data: {
      workspaceId: task.project.workspaceId,
      projectId: task.projectId,
      name: input.name,
      url,
      size: input.size,
      mimeType: input.mimeType,
      uploadedById: uploaderId,
    },
  });

  const attachment = await prisma.attachment.create({
    data: {
      taskId,
      fileId: record.id,
      fileName: input.name,
      fileUrl: url,
      fileSize: input.size,
      mimeType: input.mimeType,
      uploadedById: uploaderId,
    },
    include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
  });

  await logActivity({
    workspaceId: task.project.workspaceId,
    projectId: task.projectId,
    taskId,
    actorId: uploaderId,
    action: "ATTACHMENT_ADDED",
    entityType: "Attachment",
    entityId: attachment.id,
    metadata: { fileName: input.name },
  });

  emitToWorkspace(task.project.workspaceId, "task:updated", await getTask(taskId));
  return attachment;
}

export async function deleteAttachment(id: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: { fileId: true, taskId: true, task: { select: { project: { select: { workspaceId: true } } } } },
  });
  if (!attachment) throw new NotFoundError("Attachment not found");

  await prisma.attachment.delete({ where: { id } });
  // The File row exists only to surface this upload under the client, so it goes too.
  if (attachment.fileId) await prisma.file.delete({ where: { id: attachment.fileId } }).catch(() => {});

  if (attachment.taskId && attachment.task) {
    emitToWorkspace(attachment.task.project.workspaceId, "task:updated", await getTask(attachment.taskId));
  }
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

  emitToWorkspace(project.workspaceId, "task:created", task);
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

  emitToWorkspace(existing.project.workspaceId, "task:updated", task);
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

  emitToWorkspace(existing.project.workspaceId, "task:moved", task);
  return task;
}

export async function deleteTask(taskId: string) {
  const existing = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!existing) throw new NotFoundError("Task not found");
  await prisma.task.delete({ where: { id: taskId } });
  emitToWorkspace(existing.project.workspaceId, "task:deleted", { id: taskId });
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
  emitToWorkspace(task.project.workspaceId, "task:updated", updated);
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
  emitToWorkspace(task.project.workspaceId, "task:updated", updated);
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

  /**
   * The route guard only covers `taskId`'s project. Without this check any member
   * could link to an arbitrary task id in another team's private list and then read
   * its title back out of `getTask`, which includes the linked task. Dependencies
   * across lists are legitimate, so the test is "can the actor see it", not "is it
   * in the same list".
   */
  const dependsOn = await prisma.task.findUnique({ where: { id: input.dependsOnId } });
  if (!dependsOn) throw new NotFoundError("The task to link to was not found");
  if (!(await resolveProjectRole(actorId, dependsOn.projectId))) {
    throw new ForbiddenError("You do not have access to the task you are linking to");
  }

  const existing = await prisma.taskDependency.findUnique({
    where: { taskId_dependsOnId: { taskId, dependsOnId: input.dependsOnId } },
  });
  if (existing) throw new ConflictError("Those tasks are already linked");

  const dependency = await prisma.taskDependency.create({
    data: { taskId, dependsOnId: input.dependsOnId, type: input.type },
    include: { dependsOn: { select: { id: true, title: true, number: true, workflowState: true } } },
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

/**
 * Creates either a finished entry (time logged by hand) or a running one — an entry
 * with no `endedAt` *is* the timer, which is what lets a timer survive a page reload
 * or carry over to another device.
 */
export async function createTimeEntry(taskId: string, userId: string, input: CreateTimeEntryInput) {
  const durationMinutes =
    input.durationMinutes ??
    (input.endedAt ? Math.round((input.endedAt.getTime() - input.startedAt.getTime()) / 60000) : undefined);

  // Two running timers on the same task by the same person would double-count the
  // work, and leave the UI with no way to say which "stop" belongs to which.
  if (durationMinutes === undefined) {
    const running = await prisma.timeEntry.findFirst({ where: { taskId, userId, endedAt: null } });
    if (running) throw new BadRequestError("A timer is already running on this task");
  }

  return prisma.timeEntry.create({
    data: { taskId, userId, ...input, durationMinutes },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

/**
 * Closes a running timer. Restricted to the person it belongs to: the UI only offers
 * "stop" on your own timer, and stopping a colleague's would write time against
 * their name without them knowing.
 */
export async function stopTimeEntry(id: string, userId: string) {
  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) throw new NotFoundError("Time entry not found");
  if (entry.userId !== userId) throw new ForbiddenError("You can only stop your own timer");
  if (entry.endedAt) throw new BadRequestError("That timer has already been stopped");

  const endedAt = new Date();
  return prisma.timeEntry.update({
    where: { id },
    data: {
      endedAt,
      // Round up, so a short burst of work records as a minute rather than as zero.
      durationMinutes: Math.max(1, Math.ceil((endedAt.getTime() - entry.startedAt.getTime()) / 60000)),
    },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
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
