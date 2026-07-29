/**
 * Moves lists onto the SySpree pipeline
 * (Open → Design (Figma) → In Progress / Web Dev → In Review → Closed).
 *
 * By default only lists still carrying the old built-in set are touched, so a
 * list whose statuses someone has customised is left exactly as it is. That
 * makes the script safe to rerun — and safe to leave in a deploy chain, since
 * once the legacy lists are converted it becomes a no-op.
 *
 * No task is ever lost: tasks are remapped onto the new status sharing their
 * category before the old status is removed.
 *
 *   pnpm --filter api db:statuses                 # every workspace
 *   pnpm --filter api db:statuses <slug>          # one workspace, by slug
 *   pnpm --filter api db:statuses <slug> --force  # convert customised lists too
 */
import { PrismaClient, type WorkflowCategory } from "@prisma/client";
import { DEFAULT_WORKFLOW_STATES } from "../src/modules/projects/project.service";

const prisma = new PrismaClient();

/** Where tasks in an old status end up, keyed by the old status's category. */
const REMAP: Record<WorkflowCategory, string> = {
  BACKLOG: "Open",
  UNSTARTED: "Open",
  STARTED: "In Progress / Web Dev",
  COMPLETED: "Closed",
  CANCELLED: "Closed",
};

/** Built-in sets shipped before the pipeline existed. */
const LEGACY_SETS = [["backlog", "to do", "in progress", "done"]];

const fingerprint = (names: string[]) => [...names].map((n) => n.toLowerCase()).sort().join("|");

const WANTED_FINGERPRINT = fingerprint(DEFAULT_WORKFLOW_STATES.map((s) => s.name));
const LEGACY_FINGERPRINTS = new Set(LEGACY_SETS.map(fingerprint));

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const slug = args.find((a) => !a.startsWith("--"));

  const projects = await prisma.project.findMany({
    where: slug ? { workspace: { slug } } : {},
    select: { id: true, name: true, workspace: { select: { slug: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (projects.length === 0) {
    console.log(slug ? `No lists found in workspace "${slug}".` : "No lists found.");
    return;
  }

  let converted = 0;
  let skipped = 0;
  let alreadyDone = 0;

  for (const project of projects) {
    const existing = await prisma.workflowState.findMany({
      where: { projectId: project.id },
      select: { id: true, name: true, category: true },
    });

    const current = fingerprint(existing.map((s) => s.name));

    if (current === WANTED_FINGERPRINT) {
      alreadyDone++;
      continue;
    }

    if (!force && !LEGACY_FINGERPRINTS.has(current)) {
      skipped++;
      console.log(
        `–  ${project.workspace.slug}/${project.name}: left alone, custom statuses ` +
          `(${existing.map((s) => s.name).join(", ") || "none"})`,
      );
      continue;
    }

    // Reuse a status that already has the right name so its tasks, and any
    // board/filter state keyed on the id, survive a rerun untouched.
    const byName = new Map(existing.map((s) => [s.name.toLowerCase(), s]));
    const wanted = new Map<string, string>();

    for (const [i, spec] of DEFAULT_WORKFLOW_STATES.entries()) {
      const match = byName.get(spec.name.toLowerCase());
      if (match) {
        await prisma.workflowState.update({
          where: { id: match.id },
          data: { color: spec.color, category: spec.category, position: i, isDefault: i === 0 },
        });
        wanted.set(spec.name, match.id);
      } else {
        const created = await prisma.workflowState.create({
          data: { projectId: project.id, ...spec, position: i, isDefault: i === 0 },
        });
        wanted.set(spec.name, created.id);
      }
    }

    const stale = existing.filter((s) => !wanted.has(s.name) && ![...wanted.values()].includes(s.id));
    let moved = 0;

    for (const old of stale) {
      const targetId = wanted.get(REMAP[old.category])!;
      const { count } = await prisma.task.updateMany({
        where: { workflowStateId: old.id },
        data: { workflowStateId: targetId },
      });
      moved += count;
      await prisma.workflowState.delete({ where: { id: old.id } });
    }

    converted++;
    console.log(
      `✓  ${project.workspace.slug}/${project.name}: ${DEFAULT_WORKFLOW_STATES.length} statuses` +
        (stale.length ? `, removed ${stale.length} old (${moved} task${moved === 1 ? "" : "s"} remapped)` : ""),
    );
  }

  console.log(
    `\nDone — ${converted} converted, ${alreadyDone} already on the pipeline, ${skipped} left alone` +
      `${skipped && !force ? " (rerun with --force to convert those too)" : ""}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
