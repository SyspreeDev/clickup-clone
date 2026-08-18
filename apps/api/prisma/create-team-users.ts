/**
 * Creates real login accounts for a batch of named team members, adds each to
 * their team (creating the team if it doesn't exist yet), and prints the
 * plaintext password once so it can be handed out directly.
 *
 *   pnpm --filter api db:create-team-users -- --workspace=<slug>
 *
 * A direct password rather than an email invite, because production is still
 * EMAIL_PROVIDER=console — an invite link would only ever land in a server
 * log no one but us can read, not in anyone's inbox.
 *
 * Idempotent: matched by email. An existing user keeps their current password
 * untouched and is just ensured to have workspace + team membership — safe to
 * rerun after adding more names without resetting anyone already set up.
 *
 * Where an email below matches a real address already seen in ClickUp's
 * export (see import-clickup-api.ts's "no matching account" list), using it
 * here is deliberate: re-running the ClickUp import after this will link that
 * person's already-imported tasks to their new account instead of leaving
 * them unassigned.
 */
import { PrismaClient, type Role } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const TEAMS: { team: string; members: { name: string; email: string; role?: Role }[] }[] = [
  {
    team: "Web Team",
    members: [
      { name: "Siddesh Samjiskar", email: "siddhesh.syspree@gmail.com" },
      { name: "Om Jadhav", email: "om.jadhav@syspree.com" },
      { name: "Pooja Varade", email: "pooja.v@syspree.com" },
      { name: "Pranita Kamble", email: "pranita.kamble@syspree.com" },
      { name: "Vedika Kolap", email: "vedika.k@syspree.com" },
    ],
  },
  {
    team: "SEO Team",
    members: [
      { name: "Ummesalma", email: "ummesalma@syspree.com" },
      { name: "Utkarsha", email: "utkarsha@syspree.com" },
      { name: "Nikita", email: "nikita@syspree.com" },
      { name: "Mitchelle", email: "mitchelle@syspree.com" },
      { name: "Shilpa Shrivastav", email: "shilpa.shrivastav@syspree.com" },
      { name: "Nishith", email: "nishith@syspree.com" },
      { name: "Sagar", email: "sagar@syspree.com" },
    ],
  },
  {
    team: "Social Media",
    members: [{ name: "Steve", email: "steve@syspree.com" }],
  },
  {
    team: "Customer Success",
    members: [{ name: "Kaveri Nair", email: "kaveri.n@syspree.com", role: "ADMIN" }],
  },
  {
    team: "Admin",
    members: [
      { name: "Caahil Murzello", email: "caahill.murzello@syspree.com" },
      { name: "John Dsouza", email: "john.dsouza@syspree.com" },
    ],
  },
];

/** 12 chars, mixed case + digits — same shape as a normally chosen password. */
function randomPassword(): string {
  return randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "9").slice(0, 12);
}

async function main() {
  const slug = process.argv.slice(2).find((a) => a.startsWith("--workspace="))?.split("=")[1];
  if (!slug) throw new Error("Usage: pnpm --filter api db:create-team-users -- --workspace=<slug>");

  const workspace = await prisma.workspace.findUnique({ where: { slug } });
  if (!workspace) throw new Error(`No workspace with slug "${slug}"`);

  const results: { team: string; name: string; email: string; password: string | null; note: string }[] = [];

  for (const group of TEAMS) {
    let team = await prisma.team.findFirst({ where: { workspaceId: workspace.id, name: group.team } });
    if (!team) {
      team = await prisma.team.create({ data: { workspaceId: workspace.id, name: group.team } });
      console.log(`+ created team "${group.team}"`);
    }

    for (const member of group.members) {
      let user = await prisma.user.findFirst({ where: { email: { equals: member.email, mode: "insensitive" } } });
      let password: string | null = null;
      let note = "existing account — password left untouched";

      if (!user) {
        password = randomPassword();
        user = await prisma.user.create({
          data: {
            email: member.email,
            name: member.name,
            passwordHash: await hashPassword(password),
            emailVerified: true,
          },
        });
        note = "created";
      }

      const role: Role = member.role ?? "MEMBER";
      await prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
        update: { status: "ACTIVE", ...(member.role ? { role } : {}) },
        create: { workspaceId: workspace.id, userId: user.id, role, status: "ACTIVE", joinedAt: new Date() },
      });

      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: user.id } },
        update: {},
        create: { teamId: team.id, userId: user.id, role: "MEMBER" },
      });

      results.push({ team: group.team, name: member.name, email: member.email, password, note });
    }
  }

  console.log("\nTeam               Name                   Email                              Password        Status");
  for (const r of results) {
    console.log(
      `${r.team.padEnd(18)} ${r.name.padEnd(22)} ${r.email.padEnd(34)} ${(r.password ?? "(unchanged)").padEnd(15)} ${r.note}`,
    );
  }
  console.log("\nPasswords are shown only once, right here — not recoverable after this. Give each person their own row.\n");
}

main()
  .catch((err) => {
    console.error(`\n✗ ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
