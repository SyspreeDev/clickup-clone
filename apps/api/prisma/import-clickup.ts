/**
 * Imports a ClickUp CSV task export into a Flowspace workspace, recreating the
 * Space → Folder → List → Task nesting it describes.
 *
 *   pnpm --filter api db:import-clickup -- --file=export.csv --workspace=<slug>
 *   pnpm --filter api db:import-clickup -- --file=export.csv --workspace=<slug> --yes
 *
 * Dry run by default: it prints exactly what it would create and touches nothing.
 * Add --yes to write.
 *
 *   --file=<path>        the CSV exported from ClickUp (required)
 *   --workspace=<slug>   target workspace slug (required)
 *   --owner=<email>      who owns anything created; defaults to the workspace owner
 *   --space=<name>       force every list into this space, ignoring the CSV's Space column
 *   --limit=<n>          only process the first n task rows, for a cautious first pass
 *
 * Idempotent: spaces, folders, lists, labels and tasks are matched by name, so a
 * re-run after a partial import fills in the gaps rather than duplicating. Tasks
 * that already exist are left exactly as they are — this will not overwrite a
 * description someone has since edited in Flowspace.
 *
 * Deliberately not imported: comments, attachments, checklists and time logs.
 * ClickUp flattens those into one cell of prose per task, and guessing structure
 * out of them would produce plausible-looking but wrong data.
 */
import { readFileSync } from "node:fs";
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/** Mirrors DEFAULT_WORKFLOW_STATES in project.service.ts — the SySpree pipeline. */
const PIPELINE: Array<{ name: string; category: "UNSTARTED" | "STARTED" | "COMPLETED"; color: string }> = [
  { name: "Open", category: "UNSTARTED", color: "#87909e" },
  { name: "Design (Figma)", category: "STARTED", color: "#14b8a6" },
  { name: "In Progress / Web Dev", category: "STARTED", color: "#3b82f6" },
  { name: "In Review", category: "STARTED", color: "#f59e0b" },
  { name: "Closed", category: "COMPLETED", color: "#22c55e" },
];

const LABEL_COLORS = ["#ff9412", "#3b82f6", "#14b8a6", "#a855f7", "#ef4444", "#22c55e", "#f59e0b"];

// ─────────────────────────── CSV ───────────────────────────

/**
 * RFC 4180 parser. ClickUp descriptions routinely contain commas, quotes and hard
 * newlines inside a single field, so splitting on commas mangles real exports —
 * hence a proper state machine rather than a regex.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  // Strip a UTF-8 BOM, which Excel-touched exports carry and which would otherwise
  // become part of the first header name.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // Handled by the \n that follows; a lone \r also ends the row.
      if (src[i + 1] !== "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      }
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/**
 * ClickUp's export header names have changed across versions and vary by account,
 * so each field accepts several spellings. Matching is case- and space-insensitive.
 */
const COLUMNS = {
  taskId: ["task id", "taskid", "id"],
  name: ["task name", "name", "task"],
  content: ["task content", "description", "content", "task description"],
  status: ["status", "task status"],
  priority: ["priority", "task priority"],
  dueDate: ["due date", "due date text", "duedate"],
  startDate: ["start date", "start date text", "startdate"],
  estimate: ["time estimated", "time estimate", "estimate"],
  space: ["space name", "space"],
  folder: ["folder name", "folder"],
  list: ["list name", "list"],
  parent: ["parent task", "parent id", "parent", "parent task id"],
  assignees: ["assignees", "assignee"],
  tags: ["tags", "tag"],
} as const;

type Field = keyof typeof COLUMNS;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function mapHeaders(header: string[]): Partial<Record<Field, number>> {
  const found: Partial<Record<Field, number>> = {};
  const normalised = header.map(norm);
  for (const [field, aliases] of Object.entries(COLUMNS) as [Field, readonly string[]][]) {
    for (const alias of aliases) {
      const idx = normalised.indexOf(alias);
      if (idx !== -1) {
        found[field] = idx;
        break;
      }
    }
  }
  return found;
}

// ─────────────────────── value coercion ───────────────────────

/**
 * ClickUp writes dates as ISO strings, as "Mon, 4 Aug 2026" prose, or as epoch
 * milliseconds depending on the column and export version. Anything unrecognised
 * yields null rather than an Invalid Date, which Prisma would reject at write time.
 */
function parseDate(raw: string | undefined): Date | null {
  const value = raw?.trim();
  if (!value) return null;

  if (/^\d{10}$/.test(value)) return new Date(Number(value) * 1000);
  if (/^\d{13}$/.test(value)) return new Date(Number(value));

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  // Guard against a stray number parsing to 1970 or a typo'd far-future year.
  const year = parsed.getUTCFullYear();
  if (year < 2000 || year > 2100) return null;
  return parsed;
}

/** "3 hours", "2h 30m", "90", "5400000" (ms) → minutes. */
function parseEstimateMinutes(raw: string | undefined): number | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;

  // ClickUp's machine-readable estimate column is milliseconds.
  if (/^\d{6,}$/.test(value)) return Math.round(Number(value) / 60000) || null;

  const hours = value.match(/(\d+(?:\.\d+)?)\s*h/);
  const mins = value.match(/(\d+(?:\.\d+)?)\s*m(?:in)?/);
  if (hours || mins) {
    const total = Math.round(Number(hours?.[1] ?? 0) * 60 + Number(mins?.[1] ?? 0));
    return total > 0 ? total : null;
  }

  const bare = Number(value);
  return Number.isFinite(bare) && bare > 0 ? Math.round(bare) : null;
}

const PRIORITY_MAP: Record<string, "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NO_PRIORITY"> = {
  urgent: "URGENT",
  "1": "URGENT",
  high: "HIGH",
  "2": "HIGH",
  normal: "MEDIUM",
  medium: "MEDIUM",
  "3": "MEDIUM",
  low: "LOW",
  "4": "LOW",
};

function parsePriority(raw: string | undefined) {
  const value = raw?.trim().toLowerCase();
  if (!value) return "NO_PRIORITY" as const;
  return PRIORITY_MAP[value] ?? ("NO_PRIORITY" as const);
}

/**
 * Places a ClickUp status on the SySpree pipeline. An exact name match wins; then a
 * few well-known ClickUp defaults; otherwise the task lands on "Open" so nothing is
 * silently filed as finished.
 */
function mapStatus(raw: string | undefined, states: Array<{ id: string; name: string; category: string }>) {
  const value = norm(raw ?? "");
  const byName = states.find((s) => norm(s.name) === value);
  if (byName) return byName;

  const started = (needle: string) => value.includes(needle);
  if (started("complete") || started("closed") || started("done")) {
    return states.find((s) => s.category === "COMPLETED") ?? states[0];
  }
  if (started("review") || started("qa")) {
    return states.find((s) => norm(s.name).includes("review")) ?? states[0];
  }
  if (started("design") || started("figma")) {
    return states.find((s) => norm(s.name).includes("design")) ?? states[0];
  }
  if (started("progress") || started("doing") || started("dev") || started("active")) {
    return states.find((s) => norm(s.name).includes("progress")) ?? states[0];
  }
  return states.find((s) => s.category === "UNSTARTED") ?? states[0];
}

/** Splits ClickUp's comma-or-semicolon separated multi-value cells. */
function splitList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[,;]/)
    .map((s) => s.trim().replace(/^["'\[]+|["'\]]+$/g, ""))
    .filter(Boolean);
}

/**
 * Derives a short list key ("WEB", "AMC") from a list name, since Flowspace shows
 * it in every task reference (WEB-14). Uniqueness is settled by the caller.
 */
function deriveKey(name: string): string {
  const words = name.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "LST";
  const initials = words.map((w) => w[0]).join("").toUpperCase();
  if (initials.length >= 3) return initials.slice(0, 4);
  return words[0].slice(0, 4).toUpperCase();
}

function flag(args: string[], name: string): string | undefined {
  const raw = args.find((a) => a.startsWith(`--${name}=`));
  return raw?.slice(name.length + 3).trim() || undefined;
}

// ───────────────────────── the import ─────────────────────────

type TaskRow = {
  externalId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  startDate: string;
  estimate: string;
  space: string;
  folder: string;
  list: string;
  parent: string;
  assignees: string[];
  tags: string[];
};

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--yes");
  const file = flag(args, "file");
  const workspaceSlug = flag(args, "workspace");
  const ownerEmail = flag(args, "owner");
  const forcedSpace = flag(args, "space");
  const limit = Number(flag(args, "limit") ?? "0") || 0;

  if (!file || !workspaceSlug) {
    console.error(
      "\nUsage: pnpm --filter api db:import-clickup -- --file=<export.csv> --workspace=<slug> [--yes]\n" +
        "       optional: --owner=<email> --space=<name> --limit=<n>\n",
    );
    process.exit(1);
  }

  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) {
    const all = await prisma.workspace.findMany({ select: { slug: true } });
    console.error(`\nNo workspace with slug "${workspaceSlug}". Available: ${all.map((w) => w.slug).join(", ")}\n`);
    process.exit(1);
  }

  // Everything created needs a createdById. Prefer an explicit --owner, else the
  // workspace's OWNER, so imported lists belong to a real person who can see them.
  const owner = ownerEmail
    ? await prisma.user.findUnique({ where: { email: ownerEmail } })
    : await prisma.workspaceMember
        .findFirst({ where: { workspaceId: workspace.id, role: "OWNER" }, include: { user: true } })
        .then((m) => m?.user ?? null);

  if (!owner) {
    console.error(`\nCould not resolve an owner${ownerEmail ? ` for ${ownerEmail}` : ""}. Pass --owner=<email>.\n`);
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(file, "utf8"));
  if (rows.length < 2) {
    console.error("\nThat file has no data rows.\n");
    process.exit(1);
  }

  const header = rows[0];
  const cols = mapHeaders(header);
  if (cols.name === undefined) {
    console.error(
      `\nCouldn't find a task-name column. Looked for: ${COLUMNS.name.join(", ")}.\n` +
        `The file's columns are:\n  ${header.join("\n  ")}\n`,
    );
    process.exit(1);
  }
  if (cols.list === undefined && !forcedSpace) {
    console.error(
      `\nCouldn't find a list column (${COLUMNS.list.join(", ")}), so there's nothing to file tasks under.\n` +
        `Either re-export from ClickUp including the List column, or pass --space=<name> to put everything in one place.\n`,
    );
    process.exit(1);
  }

  const cell = (row: string[], field: Field) => {
    const idx = cols[field];
    return idx === undefined ? "" : (row[idx] ?? "").trim();
  };

  let dataRows = rows.slice(1);
  if (limit > 0) dataRows = dataRows.slice(0, limit);

  const tasks: TaskRow[] = dataRows
    .map((row) => ({
      externalId: cell(row, "taskId"),
      title: cell(row, "name"),
      description: cell(row, "content"),
      status: cell(row, "status"),
      priority: cell(row, "priority"),
      dueDate: cell(row, "dueDate"),
      startDate: cell(row, "startDate"),
      estimate: cell(row, "estimate"),
      space: forcedSpace ?? cell(row, "space") ?? "",
      folder: cell(row, "folder"),
      list: cell(row, "list"),
      parent: cell(row, "parent"),
      assignees: splitList(cell(row, "assignees")),
      tags: splitList(cell(row, "tags")),
    }))
    .filter((t) => t.title !== "");

  // ClickUp writes "hidden" for a folder that doesn't really exist, and repeats the
  // list name in the Space column when a list sits at the space root.
  const cleanFolder = (name: string) => (norm(name) === "hidden" || !name ? "" : name);

  console.log(`\nFile:        ${file}`);
  console.log(`Workspace:   ${workspace.name} (${workspace.slug})`);
  console.log(`Owner:       ${owner.name} <${owner.email}>`);
  console.log(`Columns:     ${(Object.keys(cols) as Field[]).join(", ")}`);
  const ignored = header.filter((h, i) => !Object.values(cols).includes(i) && h.trim());
  if (ignored.length) console.log(`Ignored:     ${ignored.join(", ")}`);
  console.log(`Task rows:   ${tasks.length}${limit ? ` (limited from ${dataRows.length})` : ""}\n`);

  // Group into the hierarchy the CSV describes.
  type ListPlan = { space: string; folder: string; list: string; rows: TaskRow[] };
  const listPlans = new Map<string, ListPlan>();
  for (const t of tasks) {
    const space = t.space || forcedSpace || "Imported";
    const folder = cleanFolder(t.folder);
    const list = t.list || space;
    const key = `${space} ${folder} ${list}`;
    if (!listPlans.has(key)) listPlans.set(key, { space, folder, list, rows: [] });
    listPlans.get(key)!.rows.push(t);
  }

  console.log(`Will ensure ${listPlans.size} list(s):`);
  for (const plan of listPlans.values()) {
    const path = [plan.space, plan.folder, plan.list].filter(Boolean).join(" › ");
    console.log(`  ${path}  —  ${plan.rows.length} task(s)`);
  }

  const unknownAssignees = new Set<string>();
  for (const t of tasks) for (const a of t.assignees) unknownAssignees.add(a);

  if (!execute) {
    console.log(`\nAssignee values seen: ${[...unknownAssignees].slice(0, 20).join(", ") || "none"}`);
    console.log("\nDry run — nothing written. Re-run with --yes to import.\n");
    return;
  }

  // ── write ──

  const stats = { spaces: 0, folders: 0, lists: 0, tasks: 0, skipped: 0, labels: 0, assigned: 0, subtasks: 0 };
  /** ClickUp task id → created Flowspace task id, for wiring up parents afterwards. */
  const idMap = new Map<string, string>();
  /** ClickUp task id → the list it landed in, so a parent lookup stays in scope. */
  const existingKeys = new Set(
    (await prisma.project.findMany({ where: { workspaceId: workspace.id }, select: { key: true } })).map((p) => p.key),
  );

  for (const plan of listPlans.values()) {
    // Space (Team)
    let team = await prisma.team.findFirst({ where: { workspaceId: workspace.id, name: plan.space } });
    if (!team) {
      team = await prisma.team.create({ data: { workspaceId: workspace.id, name: plan.space } });
      stats.spaces++;
      console.log(`+ space   ${plan.space}`);
    }

    // Folder (ProjectFolder), only when the CSV actually had one
    let folderId: string | null = null;
    if (plan.folder) {
      let folder = await prisma.projectFolder.findFirst({
        where: { workspaceId: workspace.id, teamId: team.id, name: plan.folder },
      });
      if (!folder) {
        folder = await prisma.projectFolder.create({
          data: {
            workspaceId: workspace.id,
            teamId: team.id,
            name: plan.folder,
            createdById: owner.id,
          },
        });
        stats.folders++;
        console.log(`+ folder  ${plan.space} › ${plan.folder}`);
      }
      folderId = folder.id;
    }

    // List (Project)
    let project = await prisma.project.findFirst({
      where: { workspaceId: workspace.id, name: plan.list },
      include: { workflowStates: { orderBy: { position: "asc" } } },
    });

    if (!project) {
      let key = deriveKey(plan.list);
      let suffix = 2;
      while (existingKeys.has(key)) key = `${deriveKey(plan.list).slice(0, 3)}${suffix++}`;
      existingKeys.add(key);

      project = await prisma.project.create({
        data: {
          workspaceId: workspace.id,
          teamId: team.id,
          folderId,
          name: plan.list,
          key,
          createdById: owner.id,
          members: { create: { userId: owner.id, role: "OWNER" } },
          workflowStates: {
            create: PIPELINE.map((s, i) => ({ ...s, position: i, isDefault: i === 0 })),
          },
        },
        include: { workflowStates: { orderBy: { position: "asc" } } },
      });
      stats.lists++;
      console.log(`+ list    ${plan.list} (${key})`);
    }

    const states = project.workflowStates;
    if (!states.length) {
      console.log(`! list "${plan.list}" has no statuses — skipping its ${plan.rows.length} task(s)`);
      stats.skipped += plan.rows.length;
      continue;
    }

    // Existing task titles in this list, so a re-run doesn't duplicate.
    const existingTasks = new Map(
      (await prisma.task.findMany({ where: { projectId: project.id }, select: { id: true, title: true } })).map(
        (t) => [norm(t.title), t.id] as const,
      ),
    );
    const lastTask = await prisma.task.findFirst({
      where: { projectId: project.id },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    let nextNumber = (lastTask?.number ?? 0) + 1;
    let position = 1000;

    // Labels are per-list in Flowspace, so resolve them inside this loop.
    const labelCache = new Map<string, string>(
      (await prisma.label.findMany({ where: { projectId: project.id }, select: { id: true, name: true } })).map(
        (l) => [norm(l.name), l.id] as const,
      ),
    );

    for (const row of plan.rows) {
      const already = existingTasks.get(norm(row.title));
      if (already) {
        if (row.externalId) idMap.set(row.externalId, already);
        stats.skipped++;
        continue;
      }

      const state = mapStatus(row.status, states);
      const dueDate = parseDate(row.dueDate);
      const startDate = parseDate(row.startDate);

      const data: Prisma.TaskUncheckedCreateInput = {
        projectId: project.id,
        workflowStateId: state.id,
        number: nextNumber++,
        position: (position += 1000),
        title: row.title,
        // Stored as a Tiptap doc so it opens in the rich-text editor rather than
        // appearing as a raw string the editor has to migrate on first open.
        description: row.description
          ? {
              type: "doc",
              content: row.description
                .split(/\r?\n/)
                .map((line) =>
                  line.trim()
                    ? { type: "paragraph", content: [{ type: "text", text: line }] }
                    : { type: "paragraph" },
                ),
            }
          : undefined,
        priority: parsePriority(row.priority),
        startDate: startDate ?? undefined,
        dueDate: dueDate ?? undefined,
        estimateMinutes: parseEstimateMinutes(row.estimate) ?? undefined,
        completedAt: state.category === "COMPLETED" ? (dueDate ?? new Date()) : undefined,
        createdById: owner.id,
      };

      const created = await prisma.task.create({ data });
      existingTasks.set(norm(row.title), created.id);
      if (row.externalId) idMap.set(row.externalId, created.id);
      stats.tasks++;

      // Tags → per-list Labels
      for (const tag of row.tags) {
        let labelId = labelCache.get(norm(tag));
        if (!labelId) {
          const label = await prisma.label.create({
            data: {
              projectId: project.id,
              name: tag,
              color: LABEL_COLORS[labelCache.size % LABEL_COLORS.length],
            },
          });
          labelId = label.id;
          labelCache.set(norm(tag), labelId);
          stats.labels++;
        }
        await prisma.taskLabel.createMany({ data: [{ taskId: created.id, labelId }], skipDuplicates: true });
      }

      // Assignees, only where the CSV value resolves to a real account. ClickUp
      // exports display names as often as emails, so this is best-effort by design:
      // an unmatched name is reported rather than guessed at.
      for (const who of row.assignees) {
        const user = who.includes("@")
          ? await prisma.user.findUnique({ where: { email: who.toLowerCase() } })
          : await prisma.user.findFirst({ where: { name: { equals: who, mode: "insensitive" } } });
        if (!user) continue;
        const isMember = await prisma.workspaceMember.findFirst({
          where: { workspaceId: workspace.id, userId: user.id },
        });
        if (!isMember) continue;
        await prisma.taskAssignee.createMany({
          data: [{ taskId: created.id, userId: user.id }],
          skipDuplicates: true,
        });
        unknownAssignees.delete(who);
        stats.assigned++;
      }
    }
  }

  // Parents last: a subtask's parent may appear anywhere in the file, so it can only
  // be linked once every row has an id.
  for (const row of tasks) {
    if (!row.parent || !row.externalId) continue;
    const childId = idMap.get(row.externalId);
    const parentId = idMap.get(row.parent);
    if (!childId || !parentId || childId === parentId) continue;
    await prisma.task.update({ where: { id: childId }, data: { parentId } });
    stats.subtasks++;
  }

  console.log(
    `\nDone. Created ${stats.spaces} space(s), ${stats.folders} folder(s), ${stats.lists} list(s), ` +
      `${stats.tasks} task(s), ${stats.labels} label(s); linked ${stats.assigned} assignee(s) and ` +
      `${stats.subtasks} subtask(s). Skipped ${stats.skipped} task(s) that already existed.`,
  );
  if (unknownAssignees.size) {
    console.log(
      `\nThese assignee values had no matching workspace account, so those tasks are unassigned:\n  ` +
        `${[...unknownAssignees].join(", ")}\n` +
        `Invite them in Flowspace and re-run, or assign by hand.`,
    );
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
