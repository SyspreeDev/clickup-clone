/**
 * Gives an existing user access to a workspace, and optionally to every space
 * in it. Written for the case Google sign-in creates: a real person signs in for
 * the first time, gets a brand-new user row with no memberships, and sees an
 * empty app until someone attaches them to the company workspace.
 *
 *   pnpm --filter api db:grant                                # list, change nothing
 *   pnpm --filter api db:grant <email> <workspace-slug>        # ADMIN + join every space
 *   pnpm --filter api db:grant <email> <slug> OWNER
 *   pnpm --filter api db:grant <email> <slug> MEMBER --no-teams
 *
 * Membership is upserted, so rerunning it just corrects the role. Safe to rerun.
 */
import { PrismaClient, type Role } from "@prisma/client";

const prisma = new PrismaClient();

const ROLES: Role[] = ["OWNER", "ADMIN", "TEAM_LEAD", "MEMBER", "GUEST"];

async function list() {
  const workspaces = await prisma.workspace.findMany({
    select: {
      slug: true,
      name: true,
      _count: { select: { members: true, teams: true, projects: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("\nWorkspaces (slug — name — members/spaces/lists):");
  for (const w of workspaces) {
    console.log(`  ${w.slug}  —  ${w.name}  —  ${w._count.members}/${w._count.teams}/${w._count.projects}`);
  }

  const users = await prisma.user.findMany({
    select: {
      email: true,
      name: true,
      passwordHash: true,
      accounts: { select: { provider: true } },
      workspaceMemberships: { select: { role: true, status: true, workspace: { select: { slug: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("\nUsers (email — name — sign-in — memberships):");
  for (const u of users) {
    const how = [u.passwordHash ? "password" : null, ...u.accounts.map((a) => a.provider)]
      .filter(Boolean)
      .join("+") || "invite-only (cannot sign in yet)";
    const memberships =
      u.workspaceMemberships
        .map((m) => `${m.workspace.slug}:${m.role}${m.status === "ACTIVE" ? "" : "(invited)"}`)
        .join(", ") || "none";
    console.log(`  ${u.email}  —  ${u.name}  —  ${how}  —  ${memberships}`);
  }
  console.log("\nTo grant:  pnpm --filter api db:grant <email> <workspace-slug> [ROLE] [--no-teams]\n");
}

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const positional = args.filter((a) => !a.startsWith("--"));
  const [email, slug, roleArg] = positional;

  if (!email || !slug) return list();

  const role = (roleArg?.toUpperCase() ?? "ADMIN") as Role;
  if (!ROLES.includes(role)) {
    throw new Error(`Role must be one of ${ROLES.join(", ")} — got "${roleArg}"`);
  }
  const joinTeams = !flags.includes("--no-teams");

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    throw new Error(`No user with email "${email}". They must sign in once first — run with no arguments to list users.`);
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true, teams: { select: { id: true, name: true } } },
  });
  if (!workspace) {
    throw new Error(`No workspace with slug "${slug}" — run with no arguments to list workspaces.`);
  }

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    // status matters as much as role: resolveProjectRole returns null for a
    // member still marked INVITED, so an INVITED admin would see nothing.
    update: { role, status: "ACTIVE", joinedAt: new Date() },
    create: { workspaceId: workspace.id, userId: user.id, role, status: "ACTIVE", joinedAt: new Date() },
  });
  console.log(`✓ ${user.email} is now ${role} of "${workspace.name}" (ACTIVE)`);

  if (!joinTeams) {
    console.log("–  skipped space membership (--no-teams)");
  } else if (workspace.teams.length === 0) {
    console.log("–  no spaces in this workspace to join");
  } else {
    // Workspace ADMIN/OWNER already reach every list, so this matters for
    // TEAM_LEAD/MEMBER — and it puts the person in the space member lists
    // either way, which is what makes them assignable.
    for (const team of workspace.teams) {
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: user.id } },
        update: { role },
        create: { teamId: team.id, userId: user.id, role },
      });
    }
    console.log(`✓ joined ${workspace.teams.length} space(s) as ${role}: ${workspace.teams.map((t) => t.name).join(", ")}`);
  }

  console.log("\nSign out and back in for the new role to take effect.\n");
}

main()
  .catch((err) => {
    console.error(`\n✗ ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
