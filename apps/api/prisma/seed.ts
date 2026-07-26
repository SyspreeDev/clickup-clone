import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEAMS = [
  { id: "seed-team-web", name: "Web Team", description: "Website & web app development" },
  { id: "seed-team-seo", name: "SEO Team", description: "Search rankings & organic growth" },
  { id: "seed-team-ads", name: "Ads", description: "Paid campaigns across Google, Meta & more" },
  { id: "seed-team-cs", name: "Customer Success", description: "Client onboarding & support" },
  { id: "seed-team-hr", name: "HR Team", description: "People, hiring & culture" },
  { id: "seed-team-sales", name: "Sales Team", description: "New business & client growth" },
];

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const owner = await prisma.user.upsert({
    where: { email: "demo@clickupclone.dev" },
    update: {},
    create: {
      email: "demo@clickupclone.dev",
      name: "Demo Owner",
      passwordHash,
      emailVerified: true,
      jobTitle: "Product Lead",
    },
  });

  const teammate = await prisma.user.upsert({
    where: { email: "teammate@clickupclone.dev" },
    update: {},
    create: {
      email: "teammate@clickupclone.dev",
      name: "Alex Rivera",
      passwordHash,
      emailVerified: true,
      jobTitle: "Engineer",
    },
  });

  // Rename the workspace in place if it still has its old demo identity;
  // otherwise upsert by the real slug (handles both a fresh DB and one
  // that already ran this migration).
  const legacyWorkspace = await prisma.workspace.findUnique({ where: { slug: "acme-inc" } });
  const workspace = legacyWorkspace
    ? await prisma.workspace.update({
        where: { id: legacyWorkspace.id },
        data: {
          name: "SySpree Digital Pvt Ltd",
          slug: "syspree-digital",
          description: "SySpree Digital Pvt Ltd — workspace",
        },
      })
    : await prisma.workspace.upsert({
        where: { slug: "syspree-digital" },
        update: {},
        create: {
          name: "SySpree Digital Pvt Ltd",
          slug: "syspree-digital",
          description: "SySpree Digital Pvt Ltd — workspace",
          members: {
            create: [
              { userId: owner.id, role: "OWNER", status: "ACTIVE", joinedAt: new Date() },
              { userId: teammate.id, role: "MEMBER", status: "ACTIVE", joinedAt: new Date() },
            ],
          },
        },
      });

  // Ensure both seed users are members (covers the migration-in-place path too).
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: owner.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: owner.id, role: "OWNER", status: "ACTIVE", joinedAt: new Date() },
  });
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: teammate.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: teammate.id, role: "MEMBER", status: "ACTIVE", joinedAt: new Date() },
  });

  // Rename the legacy "Engineering" team to "Web Team" in place (keeps its
  // existing project linkage), then upsert the rest of the real teams.
  const legacyTeam = await prisma.team.findUnique({ where: { id: "seed-team-eng" } });

  const webTeam = legacyTeam
    ? await prisma.team.update({
        where: { id: "seed-team-eng" },
        data: { name: "Web Team", description: "Website & web app development" },
      })
    : await prisma.team.upsert({
        where: { id: "seed-team-web" },
        update: {},
        create: {
          id: "seed-team-web",
          workspaceId: workspace.id,
          name: "Web Team",
          description: "Website & web app development",
          members: {
            create: [
              { userId: owner.id, role: "TEAM_LEAD" },
              { userId: teammate.id, role: "MEMBER" },
            ],
          },
        },
      });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: webTeam.id, userId: owner.id } },
    update: {},
    create: { teamId: webTeam.id, userId: owner.id, role: "TEAM_LEAD" },
  });
  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: webTeam.id, userId: teammate.id } },
    update: {},
    create: { teamId: webTeam.id, userId: teammate.id, role: "MEMBER" },
  });

  for (const t of TEAMS) {
    if (t.id === "seed-team-web") continue; // handled above (may be the renamed legacy row)
    const team = await prisma.team.upsert({
      where: { id: t.id },
      update: { name: t.name, description: t.description },
      create: { id: t.id, workspaceId: workspace.id, name: t.name, description: t.description },
    });
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: owner.id } },
      update: {},
      create: { teamId: team.id, userId: owner.id, role: "TEAM_LEAD" },
    });
  }

  const existingProject = await prisma.project.findUnique({
    where: { workspaceId_key: { workspaceId: workspace.id, key: "ENG" } },
  });

  const project =
    existingProject ??
    (await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        teamId: webTeam.id,
        name: "Website Relaunch",
        key: "ENG",
        description: "Rebuild the marketing site on the new design system",
        status: "ACTIVE",
        createdById: owner.id,
        members: {
          create: [
            { userId: owner.id, role: "OWNER" },
            { userId: teammate.id, role: "MEMBER" },
          ],
        },
        workflowStates: {
          create: [
            { name: "Backlog", category: "BACKLOG", color: "#94a3b8", position: 0 },
            { name: "To Do", category: "UNSTARTED", color: "#64748b", position: 1, isDefault: true },
            { name: "In Progress", category: "STARTED", color: "#3b82f6", position: 2 },
            { name: "Done", category: "COMPLETED", color: "#22c55e", position: 3 },
          ],
        },
        labels: {
          create: [
            { name: "bug", color: "#ef4444" },
            { name: "feature", color: "#8b5cf6" },
            { name: "design", color: "#ec4899" },
          ],
        },
      },
    }));

  // Backfill: if the project already existed but wasn't yet linked to Web Team, fix it.
  if (existingProject && existingProject.teamId !== webTeam.id) {
    await prisma.project.update({ where: { id: existingProject.id }, data: { teamId: webTeam.id } });
  }

  const states = await prisma.workflowState.findMany({ where: { projectId: project.id }, orderBy: { position: "asc" } });
  const [backlog, todo, inProgress, done] = states;

  const taskCount = await prisma.task.count({ where: { projectId: project.id } });
  if (taskCount === 0 && backlog && todo && inProgress && done) {
    await prisma.task.createMany({
      data: [
        {
          projectId: project.id,
          number: 1,
          workflowStateId: todo.id,
          title: "Set up design tokens",
          priority: "HIGH",
          position: 1000,
          createdById: owner.id,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
        {
          projectId: project.id,
          number: 2,
          workflowStateId: inProgress.id,
          title: "Build marketing homepage",
          priority: "URGENT",
          position: 1000,
          createdById: owner.id,
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        },
        {
          projectId: project.id,
          number: 3,
          workflowStateId: done.id,
          title: "Audit accessibility",
          priority: "MEDIUM",
          position: 1000,
          createdById: teammate.id,
          completedAt: new Date(),
        },
        {
          projectId: project.id,
          number: 4,
          workflowStateId: backlog.id,
          title: "Write launch announcement",
          priority: "LOW",
          position: 1000,
          createdById: owner.id,
        },
      ],
    });

    const homepageTask = await prisma.task.findFirst({ where: { projectId: project.id, number: 2 } });
    if (homepageTask) {
      await prisma.taskAssignee.create({ data: { taskId: homepageTask.id, userId: teammate.id } });
    }
  }

  const existingChannel = await prisma.channel.findFirst({ where: { workspaceId: workspace.id, name: "general" } });
  if (!existingChannel) {
    const channel = await prisma.channel.create({
      data: {
        workspaceId: workspace.id,
        name: "general",
        type: "PUBLIC",
        topic: "Company-wide announcements and casual chat",
        createdById: owner.id,
        members: {
          create: [
            { userId: owner.id, role: "ADMIN" },
            { userId: teammate.id, role: "MEMBER" },
          ],
        },
      },
    });
    await prisma.message.create({
      data: { channelId: channel.id, authorId: owner.id, content: "Welcome to the SySpree Digital workspace! 👋" },
    });
  }

  console.log("Seed complete:");
  console.log(`  demo login: demo@clickupclone.dev / password123`);
  console.log(`  teammate login: teammate@clickupclone.dev / password123`);
  console.log(`  workspace: ${workspace.name} (${workspace.slug})`);
  console.log(`  teams: Web Team, SEO Team, Ads, Customer Success, HR Team, Sales Team`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
