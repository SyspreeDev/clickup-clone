import type { Role } from "@prisma/client";
import { ROLE_RANK } from "@repo/shared-types";
import { prisma } from "./prisma";
import { ForbiddenError } from "./errors";

/**
 * The single source of truth for "what may this user do on this project (list)".
 *
 * Access is granted through three independent paths, and the strongest one wins:
 *   1. Workspace OWNER/ADMIN  — blanket access to every project, so managers can
 *      never be locked out of their own workspace.
 *   2. Team (space) member    — access to that team's projects. This is what makes
 *      "the Web team sees Web team work" true without adding people project by
 *      project. Skipped for projects explicitly marked private.
 *   3. Explicit ProjectMember — access to exactly one project, which is how a
 *      client or guest is scoped down to their own list.
 *
 * Returns null when the user has no access at all (including workspace members
 * whose invite is still pending).
 */
export async function resolveProjectRole(userId: string, projectId: string): Promise<Role | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true, teamId: true, isPrivate: true },
  });
  if (!project) return null;

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    select: { role: true, status: true },
  });
  // A pending (INVITED) member has claimed nothing yet — treat as no access.
  if (!workspaceMembership || workspaceMembership.status !== "ACTIVE") return null;

  if (ROLE_RANK[workspaceMembership.role] >= ROLE_RANK.ADMIN) return workspaceMembership.role;

  let best: Role | null = null;
  const consider = (role: Role | null | undefined) => {
    if (role && (best === null || ROLE_RANK[role] > ROLE_RANK[best])) best = role;
  };

  const projectMembership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  consider(projectMembership?.role);

  if (project.teamId && !project.isPrivate) {
    const teamMembership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: project.teamId, userId } },
      select: { role: true },
    });
    consider(teamMembership?.role);
  }

  return best;
}

/** Throws unless the user's effective project role meets `minRole`. Returns that role. */
export async function assertProjectRole(userId: string, projectId: string, minRole: Role): Promise<Role> {
  const role = await resolveProjectRole(userId, projectId);
  if (!role) throw new ForbiddenError("You do not have access to this project");
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new ForbiddenError(`Requires role ${minRole} or higher`);
  }
  return role;
}

/**
 * A Prisma `where` fragment restricting projects to the ones this user may see,
 * so listings never leak the names of projects the user cannot open.
 * Returns `{}` for managers (no restriction) and null when the user has no
 * active membership in the workspace at all.
 */
export async function accessibleProjectWhere(
  userId: string,
  workspaceId: string,
): Promise<Record<string, unknown> | null> {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true, status: true },
  });
  if (!membership || membership.status !== "ACTIVE") return null;
  if (ROLE_RANK[membership.role] >= ROLE_RANK.ADMIN) return {};

  const teams = await prisma.teamMember.findMany({
    where: { userId, team: { workspaceId } },
    select: { teamId: true },
  });
  const teamIds = teams.map((t) => t.teamId);

  return {
    OR: [
      { members: { some: { userId } } },
      ...(teamIds.length > 0 ? [{ teamId: { in: teamIds }, isPrivate: false }] : []),
    ],
  };
}
