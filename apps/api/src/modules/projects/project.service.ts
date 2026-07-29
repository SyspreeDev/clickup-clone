import { prisma } from "../../lib/prisma";
import { accessibleProjectWhere } from "../../lib/access";
import { NotFoundError } from "../../lib/errors";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  CreateLabelInput,
  CreateMilestoneInput,
  CreateWorkflowStateInput,
} from "@repo/shared-types";

const DEFAULT_WORKFLOW_STATES: Array<{ name: string; category: CreateWorkflowStateInput["category"]; color: string }> = [
  { name: "Backlog", category: "BACKLOG", color: "#94a3b8" },
  { name: "To Do", category: "UNSTARTED", color: "#64748b" },
  { name: "In Progress", category: "STARTED", color: "#3b82f6" },
  { name: "Done", category: "COMPLETED", color: "#22c55e" },
];

export async function createProject(workspaceId: string, creatorId: string, input: CreateProjectInput) {
  return prisma.project.create({
    data: {
      workspaceId,
      teamId: input.teamId,
      folderId: input.folderId,
      name: input.name,
      key: input.key.toUpperCase(),
      description: input.description,
      icon: input.icon,
      color: input.color,
      status: input.status,
      startDate: input.startDate,
      targetDate: input.targetDate,
      isPrivate: input.isPrivate,
      createdById: creatorId,
      members: { create: { userId: creatorId, role: "OWNER" } },
      workflowStates: {
        create: DEFAULT_WORKFLOW_STATES.map((s, i) => ({ ...s, position: i, isDefault: i === 1 })),
      },
    },
    include: { workflowStates: { orderBy: { position: "asc" } } },
  });
}

/**
 * Lists only the projects this user may open, so the sidebar never reveals the
 * names of other teams' work. Managers (workspace ADMIN/OWNER) get everything.
 */
export async function listProjects(
  workspaceId: string,
  userId: string,
  filters: { teamId?: string; status?: string },
) {
  const accessFilter = await accessibleProjectWhere(userId, workspaceId);
  if (!accessFilter) return [];

  return prisma.project.findMany({
    where: {
      workspaceId,
      isArchived: false,
      ...accessFilter,
      ...(filters.teamId ? { teamId: filters.teamId } : {}),
      ...(filters.status ? { status: filters.status as never } : {}),
    },
    include: {
      _count: { select: { tasks: true, members: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workflowStates: { orderBy: { position: "asc" } },
      labels: true,
      milestones: true,
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } } },
      _count: { select: { tasks: true } },
    },
  });
  if (!project) throw new NotFoundError("Project not found");
  return project;
}

export async function updateProject(projectId: string, input: UpdateProjectInput) {
  return prisma.project.update({ where: { id: projectId }, data: input });
}

export async function archiveProject(projectId: string) {
  await prisma.project.update({ where: { id: projectId }, data: { isArchived: true } });
}

export async function addMember(projectId: string, userId: string, role: string) {
  return prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: { role: role as never },
    create: { projectId, userId, role: role as never },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function removeMember(projectId: string, userId: string) {
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
}

export async function listWorkflowStates(projectId: string) {
  return prisma.workflowState.findMany({ where: { projectId }, orderBy: { position: "asc" } });
}

export async function createWorkflowState(projectId: string, input: CreateWorkflowStateInput) {
  return prisma.workflowState.create({ data: { projectId, ...input } });
}

export async function updateWorkflowState(id: string, input: Partial<CreateWorkflowStateInput>) {
  return prisma.workflowState.update({ where: { id }, data: input });
}

export async function deleteWorkflowState(id: string) {
  await prisma.workflowState.delete({ where: { id } });
}

export async function listLabels(projectId: string) {
  return prisma.label.findMany({ where: { projectId }, orderBy: { name: "asc" } });
}

export async function createLabel(projectId: string, input: CreateLabelInput) {
  return prisma.label.create({ data: { projectId, ...input } });
}

export async function updateLabel(id: string, input: Partial<CreateLabelInput>) {
  return prisma.label.update({ where: { id }, data: input });
}

export async function deleteLabel(id: string) {
  await prisma.label.delete({ where: { id } });
}

export async function listMilestones(projectId: string) {
  return prisma.milestone.findMany({ where: { projectId }, orderBy: { targetDate: "asc" } });
}

export async function createMilestone(projectId: string, input: CreateMilestoneInput) {
  return prisma.milestone.create({ data: { projectId, ...input } });
}

export async function updateMilestone(id: string, input: Partial<CreateMilestoneInput> & { isCompleted?: boolean }) {
  return prisma.milestone.update({ where: { id }, data: input });
}

export async function deleteMilestone(id: string) {
  await prisma.milestone.delete({ where: { id } });
}
