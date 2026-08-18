/**
 * One-time cleanup for a specific real-workspace import: the ClickUp API
 * importer left two lists stranded under a generic "ClickUp Import" holding
 * team instead of their real home, because their ClickUp space/folder didn't
 * map cleanly:
 *   - "List" (61 tasks, folder literally named "Google Ads") — really belongs
 *     under the Ads team; it's a client roster for Google Ads campaigns.
 *   - "Speed Audit  Responsiveness Audit" (2 tasks, folder "Development") —
 *     really belongs under Web Team, alongside the existing (empty) "Speed
 *     Audit Responsiveness" list.
 *
 * This also renames "Ads" -> "Google Ads" and ensures a "Social Media" team
 * exists, matching the real org structure (Web, SEO, Social Media, Google
 * Ads). Everything here is idempotent — rerunning after a partial run, or
 * after the fixes already landed, is a safe no-op.
 *
 *   pnpm --filter api exec tsx prisma/reorganize-clickup-import.ts <workspace-slug>
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: tsx reorganize-clickup-import.ts <workspace-slug>");
    process.exit(1);
  }

  const workspace = await prisma.workspace.findUnique({ where: { slug } });
  if (!workspace) throw new Error(`No workspace with slug "${slug}"`);
  console.log(`Workspace: ${workspace.name} (${workspace.id})`);

  // 1. Rename "Ads" -> "Google Ads" (skip if already done, or if a distinct
  // "Google Ads" team already exists and "Ads" is gone).
  const adsTeam =
    (await prisma.team.findFirst({ where: { workspaceId: workspace.id, name: "Ads" } })) ??
    (await prisma.team.findFirst({ where: { workspaceId: workspace.id, name: "Google Ads" } }));
  if (!adsTeam) throw new Error('No "Ads" or "Google Ads" team found — aborting rather than guessing.');
  if (adsTeam.name !== "Google Ads") {
    await prisma.team.update({ where: { id: adsTeam.id }, data: { name: "Google Ads" } });
    console.log(`Renamed team "Ads" -> "Google Ads" (${adsTeam.id})`);
  } else {
    console.log(`Team already named "Google Ads" (${adsTeam.id}) — skipped`);
  }

  // 2. Ensure "Social Media" team exists.
  let socialTeam = await prisma.team.findFirst({ where: { workspaceId: workspace.id, name: "Social Media" } });
  if (!socialTeam) {
    socialTeam = await prisma.team.create({
      data: { workspaceId: workspace.id, name: "Social Media", description: "Organic social & content" },
    });
    console.log(`Created team "Social Media" (${socialTeam.id})`);
  } else {
    console.log(`Team "Social Media" already exists (${socialTeam.id}) — skipped`);
  }

  // 3. Find Web Team (needed as the destination for the Speed Audit list).
  const webTeam = await prisma.team.findFirst({ where: { workspaceId: workspace.id, name: "Web Team" } });
  if (!webTeam) throw new Error('No "Web Team" found — aborting rather than guessing a destination.');

  // 4. Move the two stray lists out of "ClickUp Import", if that team still exists.
  const importTeam = await prisma.team.findFirst({ where: { workspaceId: workspace.id, name: "ClickUp Import" } });
  if (!importTeam) {
    console.log('No "ClickUp Import" team found — already cleaned up, nothing to move.');
  } else {
    const strayProjects = await prisma.project.findMany({ where: { teamId: importTeam.id } });
    console.log(`Found ${strayProjects.length} list(s) still under "ClickUp Import":`, strayProjects.map((p) => p.name));

    for (const project of strayProjects) {
      if (project.name.trim() === "List") {
        await prisma.project.update({
          where: { id: project.id },
          data: { teamId: adsTeam.id, folderId: null, name: "Google Ads Clients" },
        });
        console.log(`Moved "${project.name}" -> Google Ads team, renamed to "Google Ads Clients" (${project.id})`);
      } else if (project.name.replace(/\s+/g, " ").trim() === "Speed Audit Responsiveness Audit") {
        await prisma.project.update({
          where: { id: project.id },
          data: { teamId: webTeam.id, folderId: null },
        });
        console.log(`Moved "${project.name}" -> Web Team (${project.id})`);
      } else {
        console.log(`Unrecognized stray list "${project.name}" (${project.id}) — leaving it in place, review manually.`);
      }
    }

    const remaining = await prisma.project.count({ where: { teamId: importTeam.id } });
    if (remaining === 0) {
      await prisma.team.delete({ where: { id: importTeam.id } }); // cascades its now-empty folders
      console.log(`"ClickUp Import" team is now empty — deleted (${importTeam.id})`);
    } else {
      console.log(`"ClickUp Import" still has ${remaining} list(s) left — not deleting the team.`);
    }
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
