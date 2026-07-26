import { prisma } from "../../lib/prisma";

export async function search(workspaceId: string, q: string) {
  if (!q || q.length < 2) {
    return { tasks: [], projects: [], members: [], files: [] };
  }

  const [tasks, projects, members, files] = await Promise.all([
    prisma.task.findMany({
      where: { project: { workspaceId }, title: { contains: q, mode: "insensitive" }, isArchived: false },
      include: { project: { select: { id: true, key: true, name: true } } },
      take: 8,
    }),
    prisma.project.findMany({
      where: { workspaceId, name: { contains: q, mode: "insensitive" }, isArchived: false },
      take: 8,
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId, user: { name: { contains: q, mode: "insensitive" } } },
      include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
      take: 8,
    }),
    prisma.file.findMany({
      where: { workspaceId, name: { contains: q, mode: "insensitive" } },
      take: 8,
    }),
  ]);

  return { tasks, projects, members: members.map((m) => m.user), files };
}
