import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";
import type { CreateTeamInput, UpdateTeamInput, AddTeamMemberInput } from "@repo/shared-types";

export async function createTeam(workspaceId: string, creatorId: string, input: CreateTeamInput) {
  return prisma.team.create({
    data: {
      workspaceId,
      name: input.name,
      description: input.description,
      icon: input.icon,
      members: { create: { userId: creatorId, role: "TEAM_LEAD" } },
    },
    include: { members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } },
  });
}

export async function listTeams(workspaceId: string) {
  return prisma.team.findMany({
    where: { workspaceId },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      _count: { select: { projects: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getTeam(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } } },
      projects: true,
    },
  });
  if (!team) throw new NotFoundError("Team not found");

  const workspaceMembers = await prisma.workspaceMember.findMany({
    where: { workspaceId: team.workspaceId, userId: { in: team.members.map((m) => m.userId) } },
    select: { userId: true, status: true },
  });
  const statusByUserId = new Map(workspaceMembers.map((m) => [m.userId, m.status]));

  return {
    ...team,
    members: team.members.map((m) => ({ ...m, workspaceStatus: statusByUserId.get(m.userId) ?? "ACTIVE" })),
  };
}

export async function updateTeam(teamId: string, input: UpdateTeamInput) {
  return prisma.team.update({ where: { id: teamId }, data: input });
}

export async function deleteTeam(teamId: string) {
  await prisma.team.delete({ where: { id: teamId } });
}

export async function addMember(teamId: string, input: AddTeamMemberInput) {
  return prisma.teamMember.upsert({
    where: { teamId_userId: { teamId, userId: input.userId } },
    update: { role: input.role },
    create: { teamId, userId: input.userId, role: input.role },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function removeMember(teamId: string, userId: string) {
  await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
}
