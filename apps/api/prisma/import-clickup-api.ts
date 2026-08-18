/**
 * Pulls a whole ClickUp workspace into Teamspree directly over the ClickUp API,
 * recreating Space → Folder → List → Task and, by default, comments, time logs,
 * checklists and subtasks. Prefer this over the CSV importer for a real migration:
 * a CSV export only gives assignee display names (not emails, so they can't be
 * matched to accounts) and flattens comments/time logs into unusable prose.
 *
 *   pnpm --filter api db:import-clickup-api -- --workspace=<slug>
 *   pnpm --filter api db:import-clickup-api -- --workspace=<slug> --yes
 *
 * Dry run by default: walks the whole hierarchy, prints exactly what it would
 * create, and writes nothing until --yes is added.
 *
 * Auth: put a personal token from ClickUp (Settings → Apps → API Token, starts
 * with pk_) in CLICKUP_API_TOKEN — an env var rather than a flag, so it doesn't
 * end up in shell history or `ps` output. --token=<pk_...> works too if you'd
 * rather not set an env var, e.g. for a single Railway Console run.
 *
 *   --clickup-team=<id>   which ClickUp workspace to read; only needed if the
 *                         token can see more than one (the dry run lists them)
 *   --workspace=<slug>    target Teamspree workspace (required)
 *   --owner=<email>       who owns anything created; defaults to the workspace owner
 *   --space=<name>        only import this one ClickUp space — a cheap first pass
 *   --list=<name>         further narrow to lists whose name contains this
 *   --limit=<n>           stop after this many tasks total, also for a first pass
 *   --include-archived    also pull archived spaces/folders/lists (default: skip)
 *   --no-comments         skip comment threads (default: included)
 *   --no-time              skip logged time entries (default: included)
 *   --no-checklists       skip checklists and subtask nesting (default: included)
 *   --attachments          also download and re-upload each task's files (default:
 *                         off — see the storage note below)
 *
 * If the token can't list any Spaces, it usually means ClickUp has specific Folders
 * or Lists shared with that account directly rather than the parent Space — a real,
 * distinct sharing mode, not a broken token. This script detects that automatically
 * and falls back to discovering lists by scanning every task the token can see, but
 * the real Space name isn't visible in that mode, so everything lands under one
 * placeholder Space (--space names it; otherwise "ClickUp Import"). Move lists to
 * their real Spaces afterward in Teamspree, or get a token with real Space access
 * if you'd rather this run place them correctly the first time.
 *
 * Idempotent, matched by name/timestamp rather than a stored ClickUp id (Teamspree's
 * Task table has no external-id column): lists and tasks by name within their parent,
 * comments by (author, exact original timestamp), time entries by (user, exact start
 * time). A re-run only fills gaps for comments and time entries — append-only history
 * that's always safe to backfill onto a task that already exists. Everything else
 * about an existing task (its fields, labels, assignees, checklists, attachments) is
 * left exactly as it is and not revisited, in case someone has since edited it in
 * Teamspree; run again with --attachments after an --attachments-less first pass and
 * nothing new will be added to tasks that already existed before that pass. Two
 * ClickUp tasks that happen to share a title in the same list will be treated as one
 * on a re-run — same risk profile as the CSV importer.
 *
 * Attachments currently land on Railway's ephemeral container disk (STORAGE_PROVIDER
 * =local) and vanish on the next redeploy, so --attachments is opt-in rather than
 * bringing that surprise by default. Move storage to S3/R2 before relying on it.
 *
 * Descriptions come across as plain text, one paragraph per line — not a markdown
 * parser, so ClickUp's own markdown formatting (bold, links, etc.) shows up as
 * literal characters rather than real rich text. Converting that correctly would
 * need a markdown-to-Tiptap parser this project doesn't carry; simple text is a
 * deliberate, honest tradeoff over a half-correct formatting conversion.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { PIPELINE, LABEL_COLORS, PRIORITY_MAP, norm, flag, deriveKey, mapStatus, textToDoc } from "./import-shared";
import { storageProvider } from "../src/lib/storage";

const prisma = new PrismaClient();

const API_BASE = "https://api.clickup.com/api/v2";

// ─────────────────────── ClickUp API client ───────────────────────

/**
 * Paces and retries requests against ClickUp's per-token rate limit (100/min on
 * Free/Unlimited/Business — the plans a small team is actually on). A fixed
 * ~700ms gap between requests stays under that without needing to track a rolling
 * window; a 429 is handled reactively on top, using X-RateLimit-Reset when present.
 */
class ClickUpClient {
  private lastRequestAt = 0;
  private readonly minGapMs = 700;

  constructor(private readonly token: string) {}

  private async pace() {
    const wait = this.minGapMs - (Date.now() - this.lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();
  }

  async get<T>(path: string, query: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    const url = new URL(`${API_BASE}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    for (let attempt = 1; attempt <= 5; attempt++) {
      await this.pace();
      const res = await fetch(url, { headers: { Authorization: this.token } });

      if (res.status === 429) {
        const resetAt = Number(res.headers.get("x-ratelimit-reset")) * 1000;
        const waitMs = resetAt > Date.now() ? resetAt - Date.now() + 500 : 5000 * attempt;
        console.log(`  (rate limited, waiting ${Math.round(waitMs / 1000)}s…)`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`ClickUp API ${res.status} on ${path}: ${body.slice(0, 300)}`);
      }
      return res.json() as Promise<T>;
    }
    throw new Error(`ClickUp API kept rate-limiting ${path} after 5 attempts`);
  }

  /** Pages through page=0.. until a short page confirms the end. */
  async *paginate<T>(path: string, query: Record<string, string | number | boolean | undefined>, key: string): AsyncGenerator<T[]> {
    for (let page = 0; ; page++) {
      const body = await this.get<Record<string, unknown> & { last_page?: boolean }>(path, { ...query, page });
      const items = (body[key] as T[]) ?? [];
      yield items;
      if (body.last_page === true || items.length < 100) break;
    }
  }
}

// ─────────────────────── ClickUp API shapes ───────────────────────
// Only the fields this script reads. ClickUp's actual objects carry a lot more.

type CuStatus = { status: string; type: "open" | "closed" | "custom" };
type CuUser = { id: number; username: string; email: string };
type CuTag = { name: string };
type CuChecklistItem = { id: string; name: string; resolved: boolean };
type CuChecklist = { id: string; name: string; items?: CuChecklistItem[] };
type CuAttachment = { id: string; title: string; url: string };
type CuTask = {
  id: string;
  name: string;
  text_content?: string;
  status: CuStatus;
  priority: { priority: string } | null;
  due_date: string | null;
  start_date: string | null;
  time_estimate: string | null;
  assignees: CuUser[];
  tags: CuTag[];
  parent: string | null;
  checklists?: CuChecklist[];
  attachments?: CuAttachment[];
};
type CuList = { id: string; name: string; archived?: boolean };
type CuFolder = { id: string; name: string; archived?: boolean; lists: CuList[] };
type CuSpace = { id: string; name: string; archived?: boolean };
type CuComment = { id: string; comment_text: string; user: CuUser; date: string };
type CuTimeEntry = { id: string; user: CuUser; start: string; end: string | null; duration: string; description: string };

// ─────────────────────────── coercion ───────────────────────────

const msToDate = (ms: string | null | undefined): Date | null => (ms ? new Date(Number(ms)) : null);
const msToMinutes = (ms: string | null | undefined): number | null => (ms ? Math.round(Number(ms) / 60000) || null : null);

function statusCategoryHint(status: CuStatus): "UNSTARTED" | "COMPLETED" | undefined {
  if (status.type === "open") return "UNSTARTED";
  if (status.type === "closed") return "COMPLETED";
  return undefined;
}

// ───────────────────────────── main ─────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--yes");
  const token = flag(args, "token") ?? process.env.CLICKUP_API_TOKEN;
  const workspaceSlug = flag(args, "workspace");
  const clickupTeamId = flag(args, "clickup-team");
  const ownerEmail = flag(args, "owner");
  const spaceFilter = flag(args, "space");
  const listFilter = flag(args, "list");
  const includeArchived = args.includes("--include-archived");
  const withComments = !args.includes("--no-comments");
  const withTime = !args.includes("--no-time");
  const withChecklists = !args.includes("--no-checklists");
  const withAttachments = args.includes("--attachments");
  const limit = Number(flag(args, "limit") ?? "0") || 0;

  if (!token || !workspaceSlug) {
    console.error(
      "\nUsage: pnpm --filter api db:import-clickup-api -- --workspace=<slug> [--yes]\n" +
        "       requires CLICKUP_API_TOKEN in the environment, or --token=<pk_...>\n" +
        "       optional: --clickup-team=<id> --owner=<email> --space=<name> --list=<name>\n" +
        "                 --limit=<n> --include-archived --no-comments --no-time --no-checklists --attachments\n",
    );
    process.exit(1);
  }

  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) {
    const all = await prisma.workspace.findMany({ select: { slug: true } });
    console.error(`\nNo workspace with slug "${workspaceSlug}". Available: ${all.map((w) => w.slug).join(", ")}\n`);
    process.exit(1);
  }

  const owner = ownerEmail
    ? await prisma.user.findUnique({ where: { email: ownerEmail } })
    : await prisma.workspaceMember
        .findFirst({ where: { workspaceId: workspace.id, role: "OWNER" }, include: { user: true } })
        .then((m) => m?.user ?? null);
  if (!owner) {
    console.error(`\nCould not resolve an owner${ownerEmail ? ` for ${ownerEmail}` : ""}. Pass --owner=<email>.\n`);
    process.exit(1);
  }

  // Only members of *this* Teamspree workspace are eligible assignees — matching
  // the CSV importer's rule that an assignee value must resolve to a real account.
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    include: { user: { select: { id: true, email: true } } },
  });
  const memberByEmail = new Map(members.map((m) => [m.user.email.toLowerCase(), m.user.id]));

  const cu = new ClickUpClient(token);

  const { teams } = await cu.get<{ teams: Array<{ id: string; name: string }> }>("/team");
  let team = clickupTeamId ? teams.find((t) => t.id === clickupTeamId) : teams[0];
  if (!team || (teams.length > 1 && !clickupTeamId)) {
    console.error(
      `\nThis token can see ${teams.length} ClickUp workspace(s):\n` +
        teams.map((t) => `  ${t.id}  ${t.name}`).join("\n") +
        `\nPass --clickup-team=<id> to pick one.\n`,
    );
    process.exit(1);
  }

  console.log(`\nClickUp workspace: ${team.name} (${team.id})`);
  console.log(`Teamspree target:  ${workspace.name} (${workspace.slug})`);
  console.log(`Owner:             ${owner.name} <${owner.email}>`);
  console.log(
    `Including:         ${["closed tasks", withComments && "comments", withTime && "time logs", withChecklists && "checklists/subtasks", withAttachments && "attachments"].filter(Boolean).join(", ")}`,
  );
  if (includeArchived) console.log(`Archived:          included`);
  if (spaceFilter) console.log(`Space filter:      "${spaceFilter}"`);
  if (listFilter) console.log(`List filter:        "${listFilter}"`);
  console.log("");

  // ── walk the hierarchy: Space → (Folder →) List, gathering every list to import ──

  type ListPlan = { space: CuSpace; folder: CuFolder | null; list: CuList };
  const plans: ListPlan[] = [];

  const archivedPasses = includeArchived ? [false, true] : [false];
  const seenSpaceIds = new Set<string>();
  const spaces: CuSpace[] = [];
  for (const archived of archivedPasses) {
    const { spaces: page } = await cu.get<{ spaces: CuSpace[] }>(`/team/${team.id}/space`, { archived });
    for (const s of page) if (!seenSpaceIds.has(s.id)) (seenSpaceIds.add(s.id), spaces.push(s));
  }

  /**
   * Some ClickUp accounts have specific Folders or Lists shared with them directly,
   * without being added to the parent Space — GET /team/{id}/space then legitimately
   * returns none, even though real tasks are reachable (GET /space/{id} on one of
   * those ids returns ACCESS_015, but GET /folder/{id} and the task endpoints work
   * fine). Detected by zero spaces coming back *before* any --space filter is
   * applied, so a filter that simply doesn't match anything doesn't trigger this.
   *
   * There is no way to learn the real Space name in this mode, so every list found
   * this way is grouped under one placeholder Space instead — --space doubles as
   * that placeholder's name here, since there's no real Space name left to filter
   * a token that can already see everything against.
   */
  const viaTaskScan = spaces.length === 0;
  if (viaTaskScan) {
    console.log(
      "No Spaces are visible to this token — ClickUp is most likely sharing specific\n" +
        "folders/lists with this account rather than the parent Space. Falling back to a\n" +
        "scan of every task this token can see, grouped by its own folder/list. The real\n" +
        "Space name isn't visible in this mode, so everything lands under one placeholder\n" +
        `Space: "${spaceFilter ?? "ClickUp Import"}". Move lists into their real Spaces\n` +
        "afterward in Teamspree, or ask whoever administers ClickUp for a token with real\n" +
        "Space access if you'd rather this run place them correctly the first time.\n",
    );

    const placeholderSpace: CuSpace = { id: "unresolved", name: spaceFilter ?? "ClickUp Import" };
    const seenListIds = new Set<string>();
    for await (const page of cu.paginate<CuTask & { folder?: CuFolder & { hidden?: boolean }; list?: CuList }>(
      `/team/${team.id}/task`,
      { include_closed: true, subtasks: true, archived: includeArchived },
      "tasks",
    )) {
      for (const t of page) {
        const list = t.list;
        if (!list || seenListIds.has(list.id)) continue;
        seenListIds.add(list.id);
        const folder = t.folder && !t.folder.hidden ? { id: t.folder.id, name: t.folder.name, lists: [] } : null;
        plans.push({ space: placeholderSpace, folder, list: { id: list.id, name: list.name } });
      }
    }
  } else {
    for (const space of spaces) {
      if (spaceFilter && norm(space.name) !== norm(spaceFilter)) continue;

      const seenFolderIds = new Set<string>();
      const folders: CuFolder[] = [];
      for (const archived of archivedPasses) {
        const { folders: page } = await cu.get<{ folders: CuFolder[] }>(`/space/${space.id}/folder`, { archived });
        for (const f of page) if (!seenFolderIds.has(f.id)) (seenFolderIds.add(f.id), folders.push(f));
      }
      for (const folder of folders) {
        for (const list of folder.lists) plans.push({ space, folder, list });
      }

      const seenListIds = new Set(folders.flatMap((f) => f.lists.map((l) => l.id)));
      const folderlessLists: CuList[] = [];
      for (const archived of archivedPasses) {
        const { lists: page } = await cu.get<{ lists: CuList[] }>(`/space/${space.id}/list`, { archived });
        for (const l of page) if (!seenListIds.has(l.id)) (seenListIds.add(l.id), folderlessLists.push(l));
      }
      for (const list of folderlessLists) plans.push({ space, folder: null, list });
    }
  }

  const filtered = plans.filter((p) => !listFilter || norm(p.list.name).includes(norm(listFilter)));

  console.log(`Found ${filtered.length} list(s):`);
  for (const p of filtered) {
    const path = [p.space.name, p.folder?.name, p.list.name].filter(Boolean).join(" › ");
    console.log(`  ${path}`);
  }
  if (!filtered.length) {
    console.log("\nNothing matched — check --space/--list, or drop --include-archived if it's over-filtering.\n");
    return;
  }

  if (!execute) {
    console.log(
      viaTaskScan
        ? "\nDry run — nothing written. (Discovering lists this way already reads every task's full\n" +
            "content once, since that's the only place their folder/list is visible in this mode —\n" +
            "unlike the normal path, this dry run isn't meaningfully cheaper than --yes itself, just\n" +
            "safe.) Re-run with --yes to import.\n"
        : "\nDry run — nothing written, no task/comment/time/checklist data fetched yet (that only happens\n" +
            "on --yes, to keep a dry run fast and free of write-adjacent API calls). Re-run with --yes to import.\n",
    );
    return;
  }

  // ── write ──

  const stats = {
    spaces: 0, folders: 0, lists: 0, tasks: 0, skippedTasks: 0, labels: 0, assigned: 0, subtasks: 0,
    comments: 0, timeEntries: 0, checklists: 0, checklistItems: 0, attachments: 0,
  };
  const unmatchedAssignees = new Set<string>();
  /** ClickUp task id → Teamspree task id, for the parent-linking pass at the end. */
  const idMap = new Map<string, string>();
  const pendingParents: Array<{ childId: string; clickupParentId: string }> = [];

  const existingKeys = new Set(
    (await prisma.project.findMany({ where: { workspaceId: workspace.id }, select: { key: true } })).map((p) => p.key),
  );

  let tasksProcessed = 0;

  for (const plan of filtered) {
    if (limit > 0 && tasksProcessed >= limit) break;

    let flowTeam = await prisma.team.findFirst({ where: { workspaceId: workspace.id, name: plan.space.name } });
    if (!flowTeam) {
      flowTeam = await prisma.team.create({ data: { workspaceId: workspace.id, name: plan.space.name } });
      stats.spaces++;
      console.log(`+ space   ${plan.space.name}`);
    }

    let folderId: string | null = null;
    if (plan.folder) {
      let flowFolder = await prisma.projectFolder.findFirst({
        where: { workspaceId: workspace.id, teamId: flowTeam.id, name: plan.folder.name },
      });
      if (!flowFolder) {
        flowFolder = await prisma.projectFolder.create({
          data: { workspaceId: workspace.id, teamId: flowTeam.id, name: plan.folder.name, createdById: owner.id },
        });
        stats.folders++;
        console.log(`+ folder  ${plan.space.name} › ${plan.folder.name}`);
      }
      folderId = flowFolder.id;
    }

    let project = await prisma.project.findFirst({
      where: { workspaceId: workspace.id, name: plan.list.name },
      include: { workflowStates: { orderBy: { position: "asc" } } },
    });
    if (!project) {
      let key = deriveKey(plan.list.name);
      let suffix = 2;
      while (existingKeys.has(key)) key = `${deriveKey(plan.list.name).slice(0, 3)}${suffix++}`;
      existingKeys.add(key);

      project = await prisma.project.create({
        data: {
          workspaceId: workspace.id,
          teamId: flowTeam.id,
          folderId,
          name: plan.list.name,
          key,
          createdById: owner.id,
          members: { create: { userId: owner.id, role: "OWNER" } },
          workflowStates: { create: PIPELINE.map((s, i) => ({ ...s, position: i, isDefault: i === 0 })) },
        },
        include: { workflowStates: { orderBy: { position: "asc" } } },
      });
      stats.lists++;
      console.log(`+ list    ${plan.list.name} (${key})`);
    }

    const states = project.workflowStates;
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

    const labelCache = new Map<string, string>(
      (await prisma.label.findMany({ where: { projectId: project.id }, select: { id: true, name: true } })).map(
        (l) => [norm(l.name), l.id] as const,
      ),
    );

    // subtasks=true so subtasks arrive inline with their siblings, in the same call.
    // In fallback mode the per-list endpoint isn't reachable either (same access gap
    // that made Space listing come back empty), so pull this one list's tasks out of
    // the team-wide endpoint instead, filtered down to just it.
    const taskSource = viaTaskScan
      ? {
          path: `/team/${team.id}/task`,
          query: { include_closed: true, subtasks: true, archived: includeArchived, "list_ids[]": plan.list.id },
        }
      : { path: `/list/${plan.list.id}/task`, query: { include_closed: true, subtasks: true, archived: includeArchived } };
    for await (const page of cu.paginate<CuTask>(taskSource.path, taskSource.query, "tasks")) {
      for (const cuTask of page) {
        if (limit > 0 && tasksProcessed >= limit) break;
        tasksProcessed++;

        const already = existingTasks.get(norm(cuTask.name));

        // Checklist items and attachments aren't reliably populated on this
        // list-scoped endpoint — only the single-task fetch is complete — so
        // only pay for that extra call when this run actually wants that data,
        // and only for a task being newly created (see below for why an existing
        // task doesn't revisit these).
        let detail: CuTask = cuTask;
        if (!already && (withChecklists || withAttachments)) {
          detail = await cu.get<CuTask>(`/task/${cuTask.id}`);
        }

        let taskId: string;
        if (already) {
          taskId = already;
          idMap.set(cuTask.id, already);
          if (cuTask.parent) pendingParents.push({ childId: already, clickupParentId: cuTask.parent });
          stats.skippedTasks++;
        } else {
          const state = mapStatus(detail.status.status, states, statusCategoryHint(detail.status));
          const dueDate = msToDate(detail.due_date);
          const startDate = msToDate(detail.start_date);

          const data: Prisma.TaskUncheckedCreateInput = {
            projectId: project.id,
            workflowStateId: state.id,
            number: nextNumber++,
            position: (position += 1000),
            title: detail.name,
            description: detail.text_content ? textToDoc(detail.text_content) : undefined,
            priority: detail.priority ? (PRIORITY_MAP[detail.priority.priority] ?? "NO_PRIORITY") : "NO_PRIORITY",
            startDate: startDate ?? undefined,
            dueDate: dueDate ?? undefined,
            estimateMinutes: msToMinutes(detail.time_estimate) ?? undefined,
            completedAt: state.category === "COMPLETED" ? (dueDate ?? new Date()) : undefined,
            createdById: owner.id,
          };

          const created = await prisma.task.create({ data });
          taskId = created.id;
          existingTasks.set(norm(detail.name), created.id);
          idMap.set(detail.id, created.id);
          if (detail.parent) pendingParents.push({ childId: created.id, clickupParentId: detail.parent });
          stats.tasks++;

          for (const tag of detail.tags) {
            let labelId = labelCache.get(norm(tag.name));
            if (!labelId) {
              const label = await prisma.label.create({
                data: { projectId: project.id, name: tag.name, color: LABEL_COLORS[labelCache.size % LABEL_COLORS.length] },
              });
              labelId = label.id;
              labelCache.set(norm(tag.name), labelId);
              stats.labels++;
            }
            await prisma.taskLabel.createMany({ data: [{ taskId, labelId }], skipDuplicates: true });
          }

          for (const assignee of detail.assignees) {
            const userId = memberByEmail.get(assignee.email.toLowerCase());
            if (!userId) {
              unmatchedAssignees.add(`${assignee.username} <${assignee.email}>`);
              continue;
            }
            await prisma.taskAssignee.createMany({ data: [{ taskId, userId }], skipDuplicates: true });
            stats.assigned++;
          }

          if (withChecklists && detail.checklists?.length) {
            let checklistPosition = 0;
            for (const cl of detail.checklists) {
              const checklist = await prisma.checklist.create({
                data: { taskId, title: cl.name, position: checklistPosition++ },
              });
              stats.checklists++;
              let itemPosition = 0;
              for (const item of cl.items ?? []) {
                await prisma.checklistItem.create({
                  data: { checklistId: checklist.id, title: item.name, isCompleted: item.resolved, position: itemPosition++ },
                });
                stats.checklistItems++;
              }
            }
          }

          if (withAttachments && detail.attachments?.length) {
            for (const att of detail.attachments) {
              try {
                const res = await fetch(att.url);
                if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
                const buffer = Buffer.from(await res.arrayBuffer());
                const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
                const stored = await storageProvider.save(att.title, buffer);

                // Deliberately writing File + Attachment rows directly rather than
                // calling task.service's addAttachment: that function also calls
                // logActivity, which emits a Socket.io event — but this script runs
                // standalone, with no server (and so no socket) ever initialized, and
                // getIO() throws if called before initSocketServer(). It would also be
                // the wrong UX even where sockets do exist: a bulk historical import
                // shouldn't fire a live "activity:new" toast at whoever's online, any
                // more than the tasks/comments/time-entries created above do — none of
                // those go through their service-layer equivalents either.
                const file = await prisma.file.create({
                  data: {
                    workspaceId: workspace.id,
                    projectId: project.id,
                    name: att.title,
                    url: stored.url,
                    size: buffer.length,
                    mimeType,
                    uploadedById: owner.id,
                  },
                });
                await prisma.attachment.create({
                  data: {
                    taskId,
                    fileId: file.id,
                    fileName: att.title,
                    fileUrl: stored.url,
                    fileSize: buffer.length,
                    mimeType,
                    uploadedById: owner.id,
                  },
                });
                stats.attachments++;
              } catch (err) {
                console.log(`  ! attachment "${att.title}" on "${detail.name}" failed: ${(err as Error).message}`);
              }
            }
          }
        }

        // Comments and time entries are append-only history rather than fields a
        // Teamspree user might have deliberately edited, so — unlike everything
        // above — they're worth backfilling even for a task that already existed,
        // which is what makes a re-run after a partial import actually fill gaps.
        // Each has its own timestamp-based fingerprint, so this stays idempotent.
        if (withComments) {
          const { comments } = await cu.get<{ comments: CuComment[] }>(`/task/${cuTask.id}/comment`);
          const existingComments = await prisma.comment.findMany({
            where: { taskId },
            select: { authorId: true, createdAt: true },
          });
          const existingKey = new Set(existingComments.map((c) => `${c.authorId}:${c.createdAt.getTime()}`));

          for (const comment of comments) {
            const authorId = memberByEmail.get(comment.user.email.toLowerCase()) ?? owner.id;
            const createdAt = msToDate(comment.date) ?? new Date();
            const key = `${authorId}:${createdAt.getTime()}`;
            if (existingKey.has(key)) continue;

            // Attribute to the owner with the real author named inline when the
            // ClickUp author has no matching Teamspree account, rather than losing
            // who actually wrote it.
            const attribution = memberByEmail.has(comment.user.email.toLowerCase())
              ? comment.comment_text
              : `${comment.comment_text}\n\n— originally by ${comment.user.username} in ClickUp`;

            await prisma.comment.create({
              data: { taskId, authorId, content: textToDoc(attribution), createdAt },
            });
            existingKey.add(key);
            stats.comments++;
          }
        }

        if (withTime) {
          const entriesRes = await cu.get<{ data: CuTimeEntry[] } | CuTimeEntry[]>(`/team/${team.id}/time_entries`, {
            task_id: cuTask.id,
          });
          const entries = Array.isArray(entriesRes) ? entriesRes : entriesRes.data ?? [];
          const existingEntries = await prisma.timeEntry.findMany({
            where: { taskId },
            select: { userId: true, startedAt: true },
          });
          const existingKey = new Set(existingEntries.map((e) => `${e.userId}:${e.startedAt.getTime()}`));

          for (const entry of entries) {
            const userId = memberByEmail.get(entry.user.email.toLowerCase());
            if (!userId) continue; // no home for this entry without a real user to attach it to
            const startedAt = msToDate(entry.start);
            if (!startedAt) continue;
            const key = `${userId}:${startedAt.getTime()}`;
            if (existingKey.has(key)) continue;

            await prisma.timeEntry.create({
              data: {
                taskId,
                userId,
                startedAt,
                endedAt: msToDate(entry.end) ?? undefined,
                durationMinutes: msToMinutes(entry.duration) ?? undefined,
                description: entry.description || undefined,
                isManual: true,
              },
            });
            existingKey.add(key);
            stats.timeEntries++;
          }
        }
      }
      if (limit > 0 && tasksProcessed >= limit) break;
    }

    console.log(`  ${plan.list.name}: ${tasksProcessed} task(s) processed so far`);
  }

  for (const { childId, clickupParentId } of pendingParents) {
    const parentId = idMap.get(clickupParentId);
    if (!parentId || parentId === childId) continue;
    await prisma.task.update({ where: { id: childId }, data: { parentId } });
    stats.subtasks++;
  }

  console.log(
    `\nDone. Created ${stats.spaces} space(s), ${stats.folders} folder(s), ${stats.lists} list(s), ${stats.tasks} task(s), ` +
      `${stats.labels} label(s); linked ${stats.assigned} assignee(s) and ${stats.subtasks} subtask(s).\n` +
      `Comments: ${stats.comments}. Time entries: ${stats.timeEntries}. Checklists: ${stats.checklists} ` +
      `(${stats.checklistItems} item(s)). Attachments: ${stats.attachments}. Skipped ${stats.skippedTasks} task(s) that already existed.`,
  );
  if (unmatchedAssignees.size) {
    console.log(
      `\nThese ClickUp assignees have no matching Teamspree account in this workspace, so their tasks are unassigned:\n  ` +
        `${[...unmatchedAssignees].join(", ")}\n` +
        `Invite them in Teamspree and re-run, or assign by hand.`,
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
