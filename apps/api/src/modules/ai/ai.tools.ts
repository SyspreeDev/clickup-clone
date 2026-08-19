import { prisma } from "../../lib/prisma";
import { accessibleProjectWhere } from "../../lib/access";

/**
 * AI tools — read-only, scoped through the same accessibleProjectWhere filter
 * as every other list endpoint, so the AI can never surface data the calling
 * user couldn't already see themselves.
 *
 * Domain note: in this app a "client" is not its own entity — it's a Task
 * (usually named after the client) living inside a delivery list such as
 * "Web Development" or "AMC". search_workspace and get_task_details are what
 * let the assistant answer client questions; get_project_stats/search_overdue_tasks
 * operate one level up, at the list/space level.
 */

export const AI_TOOLS = [
  {
    name: "search_workspace",
    description:
      "Search across everything the user has access to — tasks (including client work, which is tracked as tasks), " +
      "lists/projects, and team members — by name or keyword. Use this FIRST whenever the user asks about a specific " +
      "named thing (a client, a task, a person, a list) and you don't already know exactly where it lives. " +
      "Follow up with get_task_details once you've found the right task.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Name or keyword to search for, e.g. a client name, task title, or person's name." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_task_details",
    description:
      "Get full details on one specific task by title — status, priority, dates, assignees, checklist progress, " +
      "comment count, and its full description (for client tasks, this is where the client brief lives: contact, " +
      "package, scope, phases). Use search_workspace first if you're not sure of the exact title or which list it's in.",
    input_schema: {
      type: "object" as const,
      properties: {
        taskTitle: { type: "string", description: "Exact or partial title of the task (e.g. a client name)." },
        projectName: {
          type: "string",
          description: "Optional: name of the list/project to disambiguate, if multiple tasks share a similar title.",
        },
      },
      required: ["taskTitle"],
    },
  },
  {
    name: "get_project_stats",
    description:
      "Get task statistics (total, completed, overdue, completion rate) for one list/project or team/space by name, " +
      "or across everything the user can see if no name is given. Use this when asked about progress, status, or " +
      "how a project/list/team is doing overall.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectName: {
          type: "string",
          description:
            "Name (or partial name) of the list/project or team/space to summarize. Omit to summarize across everything the user has access to.",
        },
      },
    },
  },
  {
    name: "search_overdue_tasks",
    description:
      "Find tasks that are past their due date and not yet completed. Optionally filter to one list/project or team/space by name. " +
      "Use this when asked about overdue work, blockers, or what's late.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectName: {
          type: "string",
          description: "Name (or partial name) of the list/project or team/space to restrict the search to. Omit to search everywhere the user has access.",
        },
        limit: {
          type: "integer",
          description: "Max number of tasks to return. Defaults to 10.",
        },
      },
    },
  },
  {
    name: "draft_client_email",
    description:
      "Get everything needed to draft a real email to a client — pulls their contact email, sales person, package, " +
      "and scope out of the client's brief (stored in their task description), plus current status and how overdue " +
      "they are. This tool only GATHERS the facts; you write the actual email yourself in your response using them. " +
      "If contactEmail comes back null, say so and ask the user for it rather than guessing one.",
    input_schema: {
      type: "object" as const,
      properties: {
        clientName: { type: "string", description: "The client's name (i.e. the task title)." },
        purpose: {
          type: "string",
          description: "What the email is for, e.g. 'status update', 'overdue follow-up', 'project kickoff', 'general check-in'.",
        },
      },
      required: ["clientName"],
    },
  },
  {
    name: "generate_report",
    description:
      "Generate a work/status report — task breakdown by status and priority, how many tasks were completed in the " +
      "recent period, overdue count, and top open workloads by assignee — for one list/team by name, or across " +
      "everything the user has access to. Use this for 'work report', 'status report', or 'how's the team doing' " +
      "style requests. This tool only gathers the numbers; write the report narrative yourself.",
    input_schema: {
      type: "object" as const,
      properties: {
        scope: {
          type: "string",
          description: "Name (or partial name) of the list/project or team/space to report on. Omit for everything the user has access to.",
        },
        periodDays: {
          type: "integer",
          description: "How many recent days to count completions over. Defaults to 7.",
        },
      },
    },
  },
];

type ToolContext = { userId: string; workspaceId: string };

/** Flattens a Tiptap JSON doc (or a legacy plain string) into readable plain text. */
function extractPlainText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value !== "object") return "";

  const lines: string[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && n.text) lines.push(n.text);
    if (Array.isArray(n.content)) {
      const before = lines.length;
      n.content.forEach(walk);
      // Blank line between block-level nodes (paragraphs, list items, etc.)
      if (n.type && n.type !== "text" && lines.length > before) lines.push("\n");
    }
  }
  walk(value);
  return lines
    .join(" ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function resolveScopedProjectIds(
  ctx: ToolContext,
  name?: string,
): Promise<{ projectIds: string[]; matchedName?: string } | { error: string }> {
  const accessFilter = await accessibleProjectWhere(ctx.userId, ctx.workspaceId);
  if (!accessFilter) return { error: "You don't have access to any lists in this workspace." };

  if (name) {
    const project = await prisma.project.findFirst({
      where: { workspaceId: ctx.workspaceId, isArchived: false, name: { contains: name, mode: "insensitive" }, ...accessFilter },
      select: { id: true, name: true },
    });
    if (project) return { projectIds: [project.id], matchedName: project.name };

    // Fall back to matching a team/space name, aggregating every accessible
    // project under it — this is what makes "how's the Web Team doing" work.
    const team = await prisma.team.findFirst({
      where: { workspaceId: ctx.workspaceId, name: { contains: name, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (team) {
      const projects = await prisma.project.findMany({
        where: { workspaceId: ctx.workspaceId, isArchived: false, teamId: team.id, ...accessFilter },
        select: { id: true },
      });
      return { projectIds: projects.map((p) => p.id), matchedName: team.name };
    }

    return { error: `No list or team named "${name}" was found (or you don't have access to it).` };
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

export async function searchWorkspace(ctx: ToolContext, input: { query?: string }) {
  const q = input.query?.trim();
  if (!q || q.length < 2) return { error: "Give me at least 2 characters to search for." };

  const accessFilter = await accessibleProjectWhere(ctx.userId, ctx.workspaceId);
  if (!accessFilter) return { error: "You don't have access to anything in this workspace." };

  const projectScope = { workspaceId: ctx.workspaceId, isArchived: false, ...accessFilter };

  const [tasks, projects, members] = await Promise.all([
    prisma.task.findMany({
      where: { project: projectScope, title: { contains: q, mode: "insensitive" }, isArchived: false },
      select: {
        title: true,
        priority: true,
        dueDate: true,
        project: { select: { name: true } },
        workflowState: { select: { name: true, category: true } },
      },
      take: 8,
    }),
    prisma.project.findMany({
      where: { ...projectScope, name: { contains: q, mode: "insensitive" } },
      select: { name: true, key: true, _count: { select: { tasks: true } } },
      take: 8,
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId: ctx.workspaceId, status: "ACTIVE", user: { name: { contains: q, mode: "insensitive" } } },
      select: { user: { select: { name: true, email: true } }, role: true },
      take: 8,
    }),
  ]);

  if (tasks.length === 0 && projects.length === 0 && members.length === 0) {
    return { query: q, matches: 0, message: `Nothing matching "${q}" was found (or you don't have access to it).` };
  }

  return {
    query: q,
    matches: tasks.length + projects.length + members.length,
    tasks: tasks.map((t) => ({
      title: t.title,
      project: t.project.name,
      status: t.workflowState.name,
      priority: t.priority,
      dueDate: t.dueDate,
    })),
    lists: projects.map((p) => ({ name: p.name, key: p.key, taskCount: p._count.tasks })),
    people: members.map((m) => ({ name: m.user.name, email: m.user.email, role: m.role })),
  };
}

export async function getTaskDetails(ctx: ToolContext, input: { taskTitle?: string; projectName?: string }) {
  const title = input.taskTitle?.trim();
  if (!title) return { error: "Give me a task title (or client name) to look up." };

  const accessFilter = await accessibleProjectWhere(ctx.userId, ctx.workspaceId);
  if (!accessFilter) return { error: "You don't have access to anything in this workspace." };

  let projectFilter: Record<string, unknown> = {};
  if (input.projectName) {
    const scope = await resolveScopedProjectIds(ctx, input.projectName);
    if ("error" in scope) return scope;
    projectFilter = { projectId: { in: scope.projectIds } };
  }

  const candidates = await prisma.task.findMany({
    where: {
      project: { workspaceId: ctx.workspaceId, isArchived: false, ...accessFilter },
      title: { contains: title, mode: "insensitive" },
      isArchived: false,
      ...projectFilter,
    },
    select: { id: true, title: true, project: { select: { name: true } } },
    take: 6,
  });

  if (candidates.length === 0) {
    return { error: `No task or client named "${title}" was found (or you don't have access to it).` };
  }

  if (candidates.length > 1) {
    // Exact (case-insensitive) match wins over a pile of partial matches.
    const exact = candidates.find((c) => c.title.toLowerCase() === title.toLowerCase());
    if (!exact) {
      return {
        ambiguous: true,
        message: `Found ${candidates.length} tasks matching "${title}" — ask the user which one, or call again with projectName to narrow it down.`,
        candidates: candidates.map((c) => ({ title: c.title, project: c.project.name })),
      };
    }
    candidates.splice(0, candidates.length, exact);
  }

  const task = await prisma.task.findUnique({
    where: { id: candidates[0].id },
    include: {
      project: { select: { name: true, key: true } },
      workflowState: { select: { name: true, category: true } },
      assignees: { select: { user: { select: { name: true } } } },
      taskLabels: { select: { label: { select: { name: true } } } },
      checklists: { include: { items: { select: { isCompleted: true } } } },
      milestone: { select: { name: true, targetDate: true } },
      _count: { select: { comments: true, subtasks: true, attachments: true } },
    },
  });
  if (!task) return { error: "That task no longer exists." };

  const checklistTotal = task.checklists.reduce((sum, c) => sum + c.items.length, 0);
  const checklistDone = task.checklists.reduce((sum, c) => sum + c.items.filter((i) => i.isCompleted).length, 0);

  return {
    title: task.title,
    project: `${task.project.name} (${task.project.key})`,
    status: task.workflowState.name,
    isOpen: task.workflowState.category !== "COMPLETED" && task.workflowState.category !== "CANCELLED",
    priority: task.priority,
    startDate: task.startDate,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    assignees: task.assignees.map((a) => a.user.name),
    labels: task.taskLabels.map((tl) => tl.label.name),
    milestone: task.milestone?.name ?? null,
    checklistProgress: checklistTotal ? `${checklistDone}/${checklistTotal} items done` : null,
    commentCount: task._count.comments,
    subtaskCount: task._count.subtasks,
    attachmentCount: task._count.attachments,
    description: extractPlainText(task.description) || "(no description)",
  };
}

/** Pulls a "Label - value" line out of a client brief, e.g. "Client Email - foo@bar.com". */
function extractBriefField(text: string, label: string): string | null {
  const match = text.match(new RegExp(`${label}\\s*[-:]\\s*(.+)`, "i"));
  return match ? match[1].trim() : null;
}

function extractEmailAddress(text: string): string | null {
  const labeled = extractBriefField(text, "Client Email");
  const candidate = labeled ?? text.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/)?.[0];
  return candidate?.match(/^[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}$/) ? candidate : null;
}

export async function draftClientEmail(ctx: ToolContext, input: { clientName?: string; purpose?: string }) {
  const clientName = input.clientName?.trim();
  if (!clientName) return { error: "Give me a client name to draft an email for." };

  const details = await getTaskDetails(ctx, { taskTitle: clientName });
  if ("error" in details || "ambiguous" in details) return details;

  const brief = details.description;
  const daysOverdue =
    details.dueDate && details.isOpen && new Date(details.dueDate) < new Date()
      ? Math.floor((Date.now() - new Date(details.dueDate).getTime()) / 86_400_000)
      : 0;
  const contactEmail = extractEmailAddress(brief);

  return {
    clientName: details.title,
    project: details.project,
    purpose: input.purpose ?? "general update",
    status: details.status,
    isOpen: details.isOpen,
    dueDate: details.dueDate,
    daysOverdue,
    checklistProgress: details.checklistProgress,
    contactEmail,
    salesPerson: extractBriefField(brief, "Sales person"),
    package: extractBriefField(brief, "Package"),
    sow: extractBriefField(brief, "SOW"),
    fullBrief: brief,
    note: contactEmail ? undefined : "No contact email was found in this client's brief — ask the user for it before drafting anything they intend to send.",
  };
}

export async function generateReport(ctx: ToolContext, input: { scope?: string; periodDays?: number }) {
  const resolved = await resolveScopedProjectIds(ctx, input.scope);
  if ("error" in resolved) return resolved;
  const { projectIds, matchedName } = resolved;
  const scopeLabel = matchedName ?? `${projectIds.length} list(s) across the workspace`;
  if (projectIds.length === 0) return { scope: scopeLabel, message: "No lists found in this scope." };

  const periodDays = Math.min(Math.max(input.periodDays ?? 7, 1), 90);
  const since = new Date(Date.now() - periodDays * 86_400_000);
  const where = { projectId: { in: projectIds }, isArchived: false } as const;

  const [tasks, completedInPeriod] = await Promise.all([
    prisma.task.findMany({
      where,
      select: {
        priority: true,
        workflowState: { select: { category: true } },
        assignees: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.task.count({ where: { ...where, completedAt: { gte: since } } }),
  ]);

  const byStatus = { BACKLOG: 0, UNSTARTED: 0, STARTED: 0, COMPLETED: 0, CANCELLED: 0 };
  const byPriority = { NO_PRIORITY: 0, LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
  const workload = new Map<string, number>();

  for (const t of tasks) {
    byStatus[t.workflowState.category] += 1;
    byPriority[t.priority] += 1;
    if (t.workflowState.category === "COMPLETED" || t.workflowState.category === "CANCELLED") continue;
    for (const a of t.assignees) workload.set(a.user.name, (workload.get(a.user.name) ?? 0) + 1);
  }

  const totalTasks = tasks.length;
  const completedTasks = byStatus.COMPLETED;
  const overdueTasks = await prisma.task.count({
    where: { ...where, dueDate: { lt: new Date() }, workflowState: { category: { notIn: ["COMPLETED", "CANCELLED"] } } },
  });

  return {
    scope: scopeLabel,
    periodDays,
    totalTasks,
    completedTasks,
    completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
    overdueTasks,
    completedInPeriod,
    byStatus,
    byPriority,
    topOpenWorkload: [...workload.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, openTasks]) => ({ name, openTasks })),
  };
}

export async function runTool(name: string, ctx: ToolContext, input: Record<string, unknown>) {
  switch (name) {
    case "search_workspace":
      return searchWorkspace(ctx, input as { query?: string });
    case "get_task_details":
      return getTaskDetails(ctx, input as { taskTitle?: string; projectName?: string });
    case "get_project_stats":
      return getProjectStats(ctx, input as { projectName?: string });
    case "search_overdue_tasks":
      return searchOverdueTasks(ctx, input as { projectName?: string; limit?: number });
    case "draft_client_email":
      return draftClientEmail(ctx, input as { clientName?: string; purpose?: string });
    case "generate_report":
      return generateReport(ctx, input as { scope?: string; periodDays?: number });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
