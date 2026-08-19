import { prisma } from "../../lib/prisma";
import { accessibleProjectWhere } from "../../lib/access";

/**
 * Stage 1 AI tools — read-only, scoped through the same accessibleProjectWhere
 * filter as every other list endpoint, so the AI can never surface data the
 * calling user couldn't already see themselves.
 */

export const AI_TOOLS = [
  {
    name: "get_project_stats",
    description:
      "Get task statistics (total, completed, overdue, completion rate) for one list/project by name, " +
      "or across every list the user can see if no name is given. Use this when asked about progress, " +
      "status, or how a project/list is doing.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectName: {
          type: "string",
          description:
            "Name (or partial name) of the list/project to summarize. Omit to summarize across all lists the user has access to.",
        },
      },
    },
  },
  {
    name: "search_overdue_tasks",
    description:
      "Find tasks that are past their due date and not yet completed. Optionally filter to one list/project by name. " +
      "Use this when asked about overdue work, blockers, or what's late.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectName: {
          type: "string",
          description: "Name (or partial name) of the list/project to restrict the search to. Omit to search everywhere the user has access.",
        },
        limit: {
          type: "integer",
          description: "Max number of tasks to return. Defaults to 10.",
        },
      },
    },
  },
];

type ToolContext = { userId: string; workspaceId: string };

async function resolveScopedProjectIds(
  ctx: ToolContext,
  projectName?: string,
): Promise<{ projectIds: string[]; matchedName?: string } | { error: string }> {
  const accessFilter = await accessibleProjectWhere(ctx.userId, ctx.workspaceId);
  if (!accessFilter) return { error: "You don't have access to any lists in this workspace." };

  if (projectName) {
    const project = await prisma.project.findFirst({
      where: { workspaceId: ctx.workspaceId, isArchived: false, name: { contains: projectName, mode: "insensitive" }, ...accessFilter },
      select: { id: true, name: true },
    });
    if (!project) return { error: `No list named "${projectName}" was found (or you don't have access to it).` };
    return { projectIds: [project.id], matchedName: project.name };
  }

  const projects = await prisma.project.findMany({
    where: { workspaceId: ctx.workspaceId, isArchived: false, ...accessFilter },
    select: { id: true },
  });
  return { projectIds: projects.map((p) => p.id) };
}

export async function getProjectStats(ctx: ToolContext, input: { projectName?: string }) {
  const scope = await resolveScopedProjectIds(ctx, input.projectName);
  if ("error" in scope) return scope;
  const { projectIds, matchedName } = scope;
  if (projectIds.length === 0) {
    return { scope: matchedName ?? "workspace", totalTasks: 0, completedTasks: 0, overdueTasks: 0, completionRate: 0 };
  }

  const where = { projectId: { in: projectIds }, isArchived: false } as const;
  const [totalTasks, completedTasks, overdueTasks] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.count({ where: { ...where, workflowState: { category: "COMPLETED" } } }),
    prisma.task.count({
      where: { ...where, dueDate: { lt: new Date() }, workflowState: { category: { notIn: ["COMPLETED", "CANCELLED"] } } },
    }),
  ]);

  return {
    scope: matchedName ?? `${projectIds.length} list(s) across the workspace`,
    totalTasks,
    completedTasks,
    overdueTasks,
    completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
  };
}

export async function searchOverdueTasks(ctx: ToolContext, input: { projectName?: string; limit?: number }) {
  const scope = await resolveScopedProjectIds(ctx, input.projectName);
  if ("error" in scope) return scope;
  const { projectIds, matchedName } = scope;
  if (projectIds.length === 0) return { scope: matchedName ?? "workspace", tasks: [] };

  const limit = Math.min(Math.max(input.limit ?? 10, 1), 25);
  const tasks = await prisma.task.findMany({
    where: {
      projectId: { in: projectIds },
      isArchived: false,
      dueDate: { lt: new Date() },
      workflowState: { category: { notIn: ["COMPLETED", "CANCELLED"] } },
    },
    select: {
      title: true,
      dueDate: true,
      priority: true,
      project: { select: { name: true, key: true } },
      workflowState: { select: { name: true } },
      assignees: { select: { user: { select: { name: true } } } },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
  });

  return {
    scope: matchedName ?? `${projectIds.length} list(s) across the workspace`,
    count: tasks.length,
    tasks: tasks.map((t) => ({
      title: t.title,
      project: `${t.project.name} (${t.project.key})`,
      status: t.workflowState.name,
      priority: t.priority,
      dueDate: t.dueDate,
      assignees: t.assignees.map((a) => a.user.name),
    })),
  };
}

export async function runTool(name: string, ctx: ToolContext, input: Record<string, unknown>) {
  switch (name) {
    case "get_project_stats":
      return getProjectStats(ctx, input as { projectName?: string });
    case "search_overdue_tasks":
      return searchOverdueTasks(ctx, input as { projectName?: string; limit?: number });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
