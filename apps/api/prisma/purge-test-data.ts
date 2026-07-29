/**
 * Removes the throwaway workspaces and accounts left behind by verification
 * harnesses, without going near real data.
 *
 *   pnpm --filter api db:purge-test          # dry run: prints the plan, changes nothing
 *   pnpm --filter api db:purge-test --yes    # actually delete
 *
 * Selection is deliberately narrow and explicit:
 *   --slug-prefix=a,b     workspaces whose slug starts with any of these
 *   --email-domain=a,b    users whose email ends with @<domain>
 *
 * Order matters. Nine tables reference User with no onDelete, so Postgres
 * restricts deleting anyone who still authors a task, comment, attachment,
 * activity, message, meeting, folder, doc or file. Everything hangs off
 * Workspace with onDelete: Cascade, so workspaces go first and take that
 * content with them; only then can the users be removed.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_SLUG_PREFIXES = ["syspree-test-", "hierarchy-test-", "tree-probe", "probe-"];
const DEFAULT_EMAIL_DOMAINS = ["example.com"];

function flagList(args: string[], name: string, fallback: string[]) {
  const raw = args.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return fallback;
  return raw
    .slice(name.length + 3)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--yes");
  const slugPrefixes = flagList(args, "slug-prefix", DEFAULT_SLUG_PREFIXES);
  const emailDomains = flagList(args, "email-domain", DEFAULT_EMAIL_DOMAINS);

  console.log(`\nWorkspace slugs starting with: ${slugPrefixes.join(", ")}`);
  console.log(`Users with email at:           ${emailDomains.map((d) => "@" + d).join(", ")}\n`);

  const allWorkspaces = await prisma.workspace.findMany({
    select: { id: true, slug: true, name: true, _count: { select: { members: true, teams: true, projects: true } } },
    orderBy: { createdAt: "asc" },
  });

  const doomedWorkspaces = allWorkspaces.filter((w) => slugPrefixes.some((p) => w.slug.startsWith(p)));
  const keptWorkspaceIds = allWorkspaces.filter((w) => !doomedWorkspaces.includes(w)).map((w) => w.id);

  console.log("── Workspaces to delete ──");
  if (doomedWorkspaces.length === 0) console.log("  (none)");
  for (const w of doomedWorkspaces) {
    const tasks = await prisma.task.count({ where: { project: { workspaceId: w.id } } });
    console.log(
      `  ${w.slug}  —  ${w.name}  —  ${w._count.members} members, ${w._count.teams} spaces, ` +
        `${w._count.projects} lists, ${tasks} tasks`,
    );
  }

  const candidates = await prisma.user.findMany({
    where: { OR: emailDomains.map((d) => ({ email: { endsWith: `@${d}` } })) },
    select: {
      id: true,
      email: true,
      name: true,
      accounts: { select: { provider: true } },
      workspaceMemberships: { select: { workspaceId: true, role: true, workspace: { select: { slug: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const doomedUsers: typeof candidates = [];
  const spared: Array<{ email: string; reason: string }> = [];

  for (const u of candidates) {
    if (u.accounts.length > 0) {
      spared.push({ email: u.email, reason: `has a real ${u.accounts.map((a) => a.provider).join("/")} sign-in` });
      continue;
    }

    // Belonging to a workspace that survives means this is not throwaway data,
    // whatever the email looks like.
    const inKept = u.workspaceMemberships.filter((m) => keptWorkspaceIds.includes(m.workspaceId));
    if (inKept.length > 0) {
      spared.push({
        email: u.email,
        reason: `member of ${inKept.map((m) => `${m.workspace.slug}:${m.role}`).join(", ")}`,
      });
      continue;
    }

    // Authored content in a surviving workspace would block the delete anyway.
    const blockers = await countBlockers(u.id, keptWorkspaceIds);
    if (blockers.length > 0) {
      spared.push({ email: u.email, reason: `still referenced by ${blockers.join(", ")} outside the doomed workspaces` });
      continue;
    }

    doomedUsers.push(u);
  }

  console.log("\n── Users to delete ──");
  if (doomedUsers.length === 0) console.log("  (none)");
  for (const u of doomedUsers) {
    const ws = u.workspaceMemberships.map((m) => m.workspace.slug).join(", ") || "no workspace";
    console.log(`  ${u.email}  —  ${u.name}  —  ${ws}`);
  }

  if (spared.length > 0) {
    console.log("\n── Matched the filter but KEEPING ──");
    for (const s of spared) console.log(`  ${s.email}  —  ${s.reason}`);
  }

  const untouched = allWorkspaces.filter((w) => !doomedWorkspaces.includes(w));
  console.log("\n── Untouched workspaces ──");
  for (const w of untouched) console.log(`  ${w.slug}  —  ${w.name}`);

  if (!execute) {
    console.log(
      `\nDry run. Would delete ${doomedWorkspaces.length} workspace(s) and ${doomedUsers.length} user(s).` +
        `\nRerun with --yes to go ahead.\n`,
    );
    return;
  }

  console.log("\nDeleting…");
  for (const w of doomedWorkspaces) {
    await prisma.workspace.delete({ where: { id: w.id } });
    console.log(`  ✓ workspace ${w.slug}`);
  }

  let removed = 0;
  for (const u of doomedUsers) {
    try {
      await prisma.user.delete({ where: { id: u.id } });
      removed++;
      console.log(`  ✓ user ${u.email}`);
    } catch {
      // A reference we didn't anticipate: report it rather than abort the run.
      const blockers = await countBlockers(u.id, null);
      console.log(`  ✗ user ${u.email} kept — still referenced by ${blockers.join(", ") || "something"}`);
    }
  }

  console.log(`\nDone — ${doomedWorkspaces.length} workspace(s) and ${removed} user(s) deleted.\n`);
}

/**
 * Counts the rows that Postgres would refuse to orphan. Pass workspaceIds to
 * limit the check to workspaces that will survive; pass null to count everywhere.
 */
async function countBlockers(userId: string, workspaceIds: string[] | null) {
  const inWorkspace = workspaceIds ? { in: workspaceIds } : undefined;
  const scope = <T>(where: T) => where;

  const [tasks, comments, attachments, activity, messages, meetings, folders, docs, files] = await Promise.all([
    prisma.task.count({
      where: scope({ createdById: userId, ...(workspaceIds ? { project: { workspaceId: inWorkspace } } : {}) }),
    }),
    prisma.comment.count({
      where: scope({ authorId: userId, ...(workspaceIds ? { task: { project: { workspaceId: inWorkspace } } } : {}) }),
    }),
    prisma.attachment.count({ where: { uploadedById: userId } }),
    prisma.activityLog.count({ where: scope({ actorId: userId, ...(workspaceIds ? { workspaceId: inWorkspace } : {}) }) }),
    prisma.message.count({
      where: scope({ authorId: userId, ...(workspaceIds ? { channel: { workspaceId: inWorkspace } } : {}) }),
    }),
    prisma.meeting.count({ where: scope({ createdById: userId, ...(workspaceIds ? { workspaceId: inWorkspace } : {}) }) }),
    prisma.folder.count({ where: scope({ createdById: userId, ...(workspaceIds ? { workspaceId: inWorkspace } : {}) }) }),
    prisma.doc.count({ where: scope({ createdById: userId, ...(workspaceIds ? { workspaceId: inWorkspace } : {}) }) }),
    prisma.file.count({ where: scope({ uploadedById: userId, ...(workspaceIds ? { workspaceId: inWorkspace } : {}) }) }),
  ]);

  return Object.entries({ tasks, comments, attachments, activity, messages, meetings, folders, docs, files })
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${n} ${label}`);
}

main()
  .catch((err) => {
    console.error(`\n✗ ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
