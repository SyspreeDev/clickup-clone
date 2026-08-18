/**
 * One-time production fix, distinct from reorganize-clickup-import.ts (that
 * one was for the local dev copy, which turned out to have a completely
 * different layout than production).
 *
 * In production, the real workspace (syspree-digital-pvt-ltd) already has
 * Customer Success/HR Team/Sales Team — empty, and not part of the real org
 * structure (Web, SEO, Social Media, Google Ads) — while the actual 323-task
 * ClickUp import landed under the *demo* workspace (syspree-digital)'s
 * "ClickUp Import" team instead of the real one.
 *
 * This script, run against production:
 *   1. Deletes Customer Success / HR Team / Sales Team from the real
 *      workspace (guarded: only if each still has zero lists).
 *   2. Renames "Ads" -> "Google Ads" and ensures "Social Media" exists.
 *   3. Moves the two ClickUp Import lists from the demo workspace into the
 *      real one's Web Team / Google Ads team, renaming on collision rather
 *      than merging tasks (merging would require remapping workflow states
 *      across projects — a real workspace project also happens to already
 *      have a 1-task "Web Development" list; that single task is a trivial
 *      manual move afterward if wanted).
 *   4. Deletes empty "syspree-test-*" workspaces (guarded: only ones with
 *      zero tasks anywhere inside them).
 *
 * Idempotent — every step checks current state first, so a partial or
 * repeated run is safe.
 *
 *   railway run --service clickup-clone -- npx tsx prisma/reorganize-production-teams.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REAL_SLUG = "syspree-digital-pvt-ltd";
const DEMO_SLUG = "syspree-digital";
const UNWANTED_TEAMS = ["Customer Success", "HR Team", "Sales Team"];

async function main() {
  const realWs = await prisma.workspace.findUnique({ where: { slug: REAL_SLUG } });
  if (!realWs) throw new Error(`No workspace with slug "${REAL_SLUG}" — aborting.`);
  console.log(`Real workspace: ${realWs.name} (${realWs.id})`);

  // 1. Delete unwanted empty teams.
  for (const name of UNWANTED_TEAMS) {
    const team = await prisma.team.findFirst({ where: { workspaceId: realWs.id, name } });
    if (!team) {
      console.log(`Team "${name}" not found — already removed, skipped.`);
      continue;
    }
    const count = await prisma.project.count({ where: { teamId: team.id } });
    if (count > 0) {
      console.log(`REFUSING to delete "${name}" (${team.id}) — it has ${count} list(s), not empty.`);
      continue;
    }
    await prisma.team.delete({ where: { id: team.id } });
    console.log(`Deleted empty team "${name}" (${team.id})`);
  }

  // 2. Rename Ads -> Google Ads, ensure Social Media exists.
  const adsTeam =
    (await prisma.team.findFirst({ where: { workspaceId: realWs.id, name: "Ads" } })) ??
    (await prisma.team.findFirst({ where: { workspaceId: realWs.id, name: "Google Ads" } }));
  if (!adsTeam) throw new Error('No "Ads" or "Google Ads" team found in the real workspace — aborting.');
  if (adsTeam.name !== "Google Ads") {
    await prisma.team.update({ where: { id: adsTeam.id }, data: { name: "Google Ads" } });
    console.log(`Renamed team "Ads" -> "Google Ads" (${adsTeam.id})`);
  } else {
    console.log(`Team already named "Google Ads" (${adsTeam.id}) — skipped`);
  }

  let socialTeam = await prisma.team.findFirst({ where: { workspaceId: realWs.id, name: "Social Media" } });
  if (!socialTeam) {
    socialTeam = await prisma.team.create({
      data: { workspaceId: realWs.id, name: "Social Media", description: "Organic social & content" },
    });
    console.log(`Created team "Social Media" (${socialTeam.id})`);
  } else {
    console.log(`Team "Social Media" already exists (${socialTeam.id}) — skipped`);
  }

  const webTeam = await prisma.team.findFirst({ where: { workspaceId: realWs.id, name: "Web Team" } });
  if (!webTeam) throw new Error('No "Web Team" found in the real workspace — aborting.');

  // 3. Move the ClickUp Import lists out of the demo workspace, if still there.
  const demoWs = await prisma.workspace.findUnique({ where: { slug: DEMO_SLUG } });
  if (!demoWs) {
    console.log(`Demo workspace "${DEMO_SLUG}" not found — nothing to move.`);
  } else {
    const importTeam = await prisma.team.findFirst({ where: { workspaceId: demoWs.id, name: "ClickUp Import" } });
    if (!importTeam) {
      console.log('No "ClickUp Import" team in the demo workspace — already moved or never existed.');
    } else {
      const strayProjects = await prisma.project.findMany({ where: { teamId: importTeam.id } });
      console.log(`Found ${strayProjects.length} list(s) under demo "ClickUp Import":`, strayProjects.map((p) => p.name));

      for (const project of strayProjects) {
        let destTeamId: string;
        let destName = project.name;

        if (project.name.trim() === "List") {
          destTeamId = adsTeam.id;
          destName = "Google Ads Clients";
        } else if (project.name.trim() === "Web Development") {
          destTeamId = webTeam.id;
          // Real Web Team already has a small "Web Development" list — avoid a
          // silent name collision rather than merging task-level data.
          const collision = await prisma.project.findFirst({ where: { teamId: webTeam.id, name: project.name } });
          if (collision) destName = `${project.name} (ClickUp Import)`;
        } else {
          console.log(`Unrecognized stray list "${project.name}" (${project.id}) — leaving it in place, review manually.`);
          continue;
        }

        await prisma.project.update({
          where: { id: project.id },
          data: { workspaceId: realWs.id, teamId: destTeamId, folderId: null, name: destName },
        });
        console.log(`Moved "${project.name}" -> real workspace as "${destName}" (${project.id})`);
      }

      const remaining = await prisma.project.count({ where: { teamId: importTeam.id } });
      if (remaining === 0) {
        await prisma.team.delete({ where: { id: importTeam.id } });
        console.log(`Demo "ClickUp Import" team is now empty — deleted (${importTeam.id})`);
      } else {
        console.log(`Demo "ClickUp Import" still has ${remaining} list(s) left — not deleting the team.`);
      }
    }
  }

  // 4. Delete empty syspree-test-* workspaces.
  const testWorkspaces = await prisma.workspace.findMany({ where: { slug: { startsWith: "syspree-test-" } } });
  for (const ws of testWorkspaces) {
    const taskCount = await prisma.task.count({ where: { project: { workspaceId: ws.id } } });
    if (taskCount > 0) {
      console.log(`REFUSING to delete workspace "${ws.slug}" (${ws.id}) — it has ${taskCount} real task(s).`);
      continue;
    }
    await prisma.workspace.delete({ where: { id: ws.id } });
    console.log(`Deleted empty test workspace "${ws.slug}" (${ws.id})`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
