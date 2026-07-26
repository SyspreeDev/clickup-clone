import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";
import { emailProvider } from "../../lib/email";
import { env } from "../../config/env";
import type { CreateWorkspaceInput, UpdateWorkspaceInput, InviteMemberInput } from "@repo/shared-types";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "workspace";
  let slug = base;
  let n = 1;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${base}-${++n}`;
  }
  return slug;
}

export async function createWorkspace(ownerId: string, input: CreateWorkspaceInput) {
  const slug = await uniqueSlug(input.name);
  return prisma.workspace.create({
    data: {
      name: input.name,
      description: input.description,
      slug,
      members: {
        create: { userId: ownerId, role: "OWNER", status: "ACTIVE", joinedAt: new Date() },
      },
    },
  });
}

export async function listMyWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, status: "ACTIVE" },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({ ...m.workspace, role: m.role }));
}

export async function getWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new NotFoundError("Workspace not found");
  return workspace;
}

export async function updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput) {
  return prisma.workspace.update({ where: { id: workspaceId }, data: input });
}

export async function deleteWorkspace(workspaceId: string) {
  await prisma.workspace.delete({ where: { id: workspaceId } });
}

export async function listMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, jobTitle: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function inviteMember(workspaceId: string, input: InviteMemberInput, inviterName: string) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });

  let user = await prisma.user.findUnique({ where: { email: input.email } });
  const alreadyHasAccount = !!user?.passwordHash;
  if (!user) {
    user = await prisma.user.create({
      data: { email: input.email, name: input.email.split("@")[0], emailVerified: false },
    });
  }

  const member = await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    update: { role: input.role },
    create: {
      workspaceId,
      userId: user.id,
      role: input.role,
      status: "INVITED",
      invitedEmail: input.email,
      invitedAt: new Date(),
    },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  });

  // Existing, already-registered users are added straight away (no signup step
  // needed) — only brand-new placeholder accounts need to actually accept.
  const inviteLink = alreadyHasAccount
    ? `${env.webOrigin}/login`
    : `${env.webOrigin}/register?email=${encodeURIComponent(input.email)}`;

  await emailProvider.send({
    to: input.email,
    subject: `${inviterName} invited you to ${workspace.name} on Flowspace`,
    html: alreadyHasAccount
      ? `<p>${inviterName} added you to <strong>${workspace.name}</strong> on Flowspace.</p><p><a href="${inviteLink}">Sign in to view it</a></p>`
      : `<p>${inviterName} invited you to join <strong>${workspace.name}</strong> on Flowspace.</p><p><a href="${inviteLink}">Create your account to accept</a></p>`,
  });

  return { ...member, inviteLink, alreadyHasAccount };
}

export async function updateMemberRole(workspaceId: string, memberId: string, role: string) {
  const member = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
  if (!member) throw new NotFoundError("Member not found");
  return prisma.workspaceMember.update({ where: { id: memberId }, data: { role: role as never } });
}

export async function removeMember(workspaceId: string, memberId: string) {
  const member = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
  if (!member) throw new NotFoundError("Member not found");
  await prisma.workspaceMember.delete({ where: { id: memberId } });
}

export async function getDashboard(workspaceId: string, userId: string) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    activeProjects,
    teamMembers,
    myTasks,
    completedTasks,
    pendingTasks,
    upcomingDeadlines,
    recentActivity,
    unreadNotifications,
    upcomingMeetings,
  ] = await Promise.all([
    prisma.project.count({ where: { workspaceId, isArchived: false, status: "ACTIVE" } }),
    prisma.workspaceMember.count({ where: { workspaceId, status: "ACTIVE" } }),
    prisma.task.count({
      where: { project: { workspaceId }, assignees: { some: { userId } }, isArchived: false, workflowState: { category: { not: "COMPLETED" } } },
    }),
    prisma.task.count({
      where: { project: { workspaceId }, workflowState: { category: "COMPLETED" }, isArchived: false },
    }),
    prisma.task.count({
      where: { project: { workspaceId }, workflowState: { category: { not: "COMPLETED" } }, isArchived: false },
    }),
    prisma.task.findMany({
      where: { project: { workspaceId }, dueDate: { gte: now, lte: in7Days }, isArchived: false },
      orderBy: { dueDate: "asc" },
      take: 8,
      include: { project: { select: { id: true, name: true, key: true } } },
    }),
    prisma.activityLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
    prisma.meeting.findMany({
      where: { workspaceId, startTime: { gte: now } },
      orderBy: { startTime: "asc" },
      take: 5,
    }),
  ]);

  return {
    kpis: {
      activeProjects,
      teamMembers,
      myTasks,
      completedTasks,
      pendingTasks,
      unreadNotifications,
    },
    upcomingDeadlines,
    recentActivity,
    upcomingMeetings,
  };
}
