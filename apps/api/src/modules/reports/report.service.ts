import { prisma } from "../../lib/prisma";

export async function teamProductivity(workspaceId: string) {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  const rows = await Promise.all(
    members.map(async (m) => {
      const [assigned, completed] = await Promise.all([
        prisma.task.count({ where: { project: { workspaceId }, assignees: { some: { userId: m.userId } }, isArchived: false } }),
        prisma.task.count({
          where: {
            project: { workspaceId },
            assignees: { some: { userId: m.userId } },
            workflowState: { category: "COMPLETED" },
            isArchived: false,
          },
        }),
      ]);
      return { userId: m.userId, name: m.user.name, avatarUrl: m.user.avatarUrl, assigned, completed };
    }),
  );

  return rows;
}

export async function projectProgress(workspaceId: string) {
  const projects = await prisma.project.findMany({
    where: { workspaceId, isArchived: false },
    include: { _count: { select: { tasks: true } } },
  });

  return Promise.all(
    projects.map(async (p) => {
      const completed = await prisma.task.count({
        where: { projectId: p.id, workflowState: { category: "COMPLETED" }, isArchived: false },
      });
      return {
        projectId: p.id,
        name: p.name,
        key: p.key,
        total: p._count.tasks,
        completed,
        percent: p._count.tasks ? Math.round((completed / p._count.tasks) * 100) : 0,
      };
    }),
  );
}

export async function taskCompletionTrend(workspaceId: string, days = 14) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const completedTasks = await prisma.task.findMany({
    where: { project: { workspaceId }, completedAt: { gte: since } },
    select: { completedAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const t of completedTasks) {
    if (!t.completedAt) continue;
    const key = t.completedAt.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}

export async function workloadDistribution(workspaceId: string) {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  return Promise.all(
    members.map(async (m) => {
      const active = await prisma.task.count({
        where: {
          project: { workspaceId },
          assignees: { some: { userId: m.userId } },
          isArchived: false,
          workflowState: { category: { not: "COMPLETED" } },
        },
      });
      return { userId: m.userId, name: m.user.name, avatarUrl: m.user.avatarUrl, activeTasks: active };
    }),
  );
}

export async function timeTrackingSummary(workspaceId: string) {
  const entries = await prisma.timeEntry.findMany({
    where: { task: { project: { workspaceId } } },
    include: { user: { select: { id: true, name: true } } },
  });

  const byUser = new Map<string, { userId: string; name: string; minutes: number }>();
  for (const e of entries) {
    const existing = byUser.get(e.userId) ?? { userId: e.userId, name: e.user.name, minutes: 0 };
    existing.minutes += e.durationMinutes ?? 0;
    byUser.set(e.userId, existing);
  }
  return Array.from(byUser.values());
}
