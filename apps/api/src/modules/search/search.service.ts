import { prisma } from "../../lib/prisma";
import { accessibleProjectWhere } from "../../lib/access";

const EMPTY = { tasks: [], projects: [], members: [], files: [] };

/**
 * Federated search, constrained to the projects this user may open — otherwise
 * search would happily surface other teams' task titles and file names.
 */
export async function search(workspaceId: string, userId: string, q: string) {
  if (!q || q.length < 2) return EMPTY;

  const accessFilter = await accessibleProjectWhere(userId, workspaceId);
  if (!accessFilter) return EMPTY;

  const projectScope = { workspaceId, isArchived: false, ...accessFilter };

  const [tasks, projects, members, files] = await Promise.all([
    prisma.task.findMany({
      where: { project: projectScope, title: { contains: q, mode: "insensitive" }, isArchived: false },
      include: { project: { select: { id: true, key: true, name: true } } },
      take: 8,
    }),
    prisma.project.findMany({
      where: { ...projectScope, name: { contains: q, mode: "insensitive" } },
      take: 8,
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId, user: { name: { contains: q, mode: "insensitive" } } },
      include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
      take: 8,
    }),
    prisma.file.findMany({
      where: {
        workspaceId,
        name: { contains: q, mode: "insensitive" },
        // Files pinned to a project inherit that project's access; loose files in
        // the shared library stay visible workspace-wide.
        OR: [{ projectId: null }, { project: projectScope }],
      },
      take: 8,
    }),
  ]);

  return { tasks, projects, members: members.map((m) => m.user), files };
}
