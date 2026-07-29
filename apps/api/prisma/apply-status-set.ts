/**
 * Replaces every list's statuses with the SySpree pipeline
 * (Open → Design (Figma) → In Progress / Web Dev → In Review → Closed).
 *
 * Safe to rerun, and never loses a task: existing tasks are remapped onto the
 * new status with the same category before the old statuses are removed.
 *
 *   pnpm --filter api db:statuses            # every workspace
 *   pnpm --filter api db:statuses <slug>     # one workspace, by slug
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

async function main() {
  const slug = process.argv[2];
  const projects = await prisma.project.findMany({
    where: slug ? { workspace: { slug } } : {},
    select: { id: true, name: true, workspace: { select: { slug: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (projects.length === 0) {
    console.log(slug ? `No lists found in workspace "${slug}".` : "No lists found.");
    return;
  }

  for (const project of projects) {
    const existing = await prisma.workflowState.findMany({
      where: { projectId: project.id },
      select: { id: true, name: true, category: true },
    });

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

    console.log(
      `✓ ${project.workspace.slug}/${project.name}: ${DEFAULT_WORKFLOW_STATES.length} statuses` +
        (stale.length ? `, removed ${stale.length} old (${moved} task${moved === 1 ? "" : "s"} remapped)` : ""),
    );
  }

  console.log(`\nDone — ${projects.length} list${projects.length === 1 ? "" : "s"} updated.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
