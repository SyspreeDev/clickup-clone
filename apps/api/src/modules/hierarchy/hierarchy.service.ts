import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { accessibleProjectWhere, resolveProjectRole } from "../../lib/access";
import { ForbiddenError, NotFoundError } from "../../lib/errors";
import type {
  CreateProjectFolderInput,
  UpdateProjectFolderInput,
  MoveProjectInput,
  CreateDocInput,
  UpdateDocInput,
} from "@repo/shared-types";

// ─────────────────────────── Folders ───────────────────────────

export async function createFolder(workspaceId: string, creatorId: string, input: CreateProjectFolderInput) {
  const team = await prisma.team.findFirst({ where: { id: input.teamId, workspaceId } });
  if (!team) throw new NotFoundError("Space not found in this workspace");

  return prisma.projectFolder.create({
    data: {
      workspaceId,
      teamId: input.teamId,
      name: input.name,
      icon: input.icon,
      color: input.color,
      isPrivate: input.isPrivate,
      position: input.position ?? 0,
      createdById: creatorId,
    },
  });
}

export async function updateFolder(folderId: string, input: UpdateProjectFolderInput) {
  return prisma.projectFolder.update({ where: { id: folderId }, data: input });
}

/** Deleting a folder keeps its lists — they fall back to sitting directly in the space. */
export async function deleteFolder(folderId: string) {
  await prisma.projectFolder.delete({ where: { id: folderId } });
}

/**
 * The whole sidebar in one call: spaces the user can see, each with its folders
 * and lists already nested, filtered by the same access rules as everything else.
 */
export async function getSidebarTree(workspaceId: string, userId: string) {
  const accessFilter = await accessibleProjectWhere(userId, workspaceId);
  if (!accessFilter) return [];

  const visibleProjects = await prisma.project.findMany({
    where: { workspaceId, isArchived: false, ...accessFilter },
    select: {
      id: true,
      name: true,
      key: true,
      icon: true,
      color: true,
      teamId: true,
      folderId: true,
      position: true,
      _count: { select: { tasks: true } },
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  // Only surface spaces the user is actually in, plus any space that holds a list
  // they can reach (e.g. a client invited to a single list).
  const isManager = Object.keys(accessFilter).length === 0;
  const teams = await prisma.team.findMany({
    where: {
      workspaceId,
      ...(isManager
        ? {}
        : {
            OR: [
              { members: { some: { userId } } },
              { id: { in: [...new Set(visibleProjects.map((p) => p.teamId).filter(Boolean))] as string[] } },
            ],
          }),
    },
    include: { folders: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return teams.map((team) => {
    const inTeam = visibleProjects.filter((p) => p.teamId === team.id);
    return {
      id: team.id,
      name: team.name,
      icon: team.icon,
      color: team.color,
      folders: team.folders.map((f) => ({
        id: f.id,
        name: f.name,
        icon: f.icon,
        color: f.color,
        isPrivate: f.isPrivate,
        lists: inTeam.filter((p) => p.folderId === f.id),
      })),
      // Lists that sit directly in the space, with no folder.
      lists: inTeam.filter((p) => p.folderId === null),
    };
  });
}

/** Moves a list into a folder or straight into a space, and/or reorders it. */
export async function moveProject(projectId: string, input: MoveProjectInput) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { workspaceId: true } });
  if (!project) throw new NotFoundError("List not found");

  if (input.folderId) {
    const folder = await prisma.projectFolder.findFirst({
      where: { id: input.folderId, workspaceId: project.workspaceId },
      select: { teamId: true },
    });
    if (!folder) throw new NotFoundError("Folder not found in this workspace");
    // Keep teamId consistent with the folder so access resolution stays correct.
    return prisma.project.update({
      where: { id: projectId },
      data: { folderId: input.folderId, teamId: folder.teamId, ...(input.position !== undefined && { position: input.position }) },
    });
  }

  if (input.teamId) {
    const team = await prisma.team.findFirst({ where: { id: input.teamId, workspaceId: project.workspaceId } });
    if (!team) throw new NotFoundError("Space not found in this workspace");
  }

  return prisma.project.update({
    where: { id: projectId },
    data: {
      folderId: null,
      ...(input.teamId !== undefined && { teamId: input.teamId }),
      ...(input.position !== undefined && { position: input.position }),
    },
  });
}

// ───────────────────────────── Docs ─────────────────────────────

const DOC_SUMMARY = {
  id: true,
  title: true,
  icon: true,
  projectId: true,
  teamId: true,
  parentId: true,
  position: true,
  updatedAt: true,
  createdAt: true,
} satisfies Prisma.DocSelect;

/** A doc attached to a list is readable exactly when that list is. */
async function assertDocScopeAccess(
  userId: string,
  workspaceId: string,
  scope: { projectId?: string | null; teamId?: string | null },
) {
  if (scope.projectId) {
    const role = await resolveProjectRole(userId, scope.projectId);
    if (!role) throw new ForbiddenError("You do not have access to this list");
    return;
  }
  if (scope.teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: scope.teamId, userId } },
    });
    if (membership) return;
    const ws = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    if (ws?.role === "OWNER" || ws?.role === "ADMIN") return;
    throw new ForbiddenError("You do not have access to this space");
  }
}

export async function createDoc(workspaceId: string, creatorId: string, input: CreateDocInput) {
  await assertDocScopeAccess(creatorId, workspaceId, input);
  return prisma.doc.create({
    data: {
      workspaceId,
      createdById: creatorId,
      title: input.title,
      icon: input.icon,
      content: (input.content ?? undefined) as Prisma.InputJsonValue | undefined,
      projectId: input.projectId,
      teamId: input.teamId,
      parentId: input.parentId,
      position: input.position ?? 0,
    },
  });
}

/** Lists docs for one scope (a list, a space, or the workspace root). */
export async function listDocs(
  workspaceId: string,
  userId: string,
  scope: { projectId?: string; teamId?: string },
) {
  await assertDocScopeAccess(userId, workspaceId, scope);
  return prisma.doc.findMany({
    where: {
      workspaceId,
      projectId: scope.projectId ?? null,
      teamId: scope.teamId ?? null,
    },
    select: DOC_SUMMARY,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

export async function getDoc(docId: string, userId: string) {
  const doc = await prisma.doc.findUnique({ where: { id: docId } });
  if (!doc) throw new NotFoundError("Doc not found");
  await assertDocScopeAccess(userId, doc.workspaceId, doc);
  return doc;
}

export async function updateDoc(docId: string, userId: string, input: UpdateDocInput) {
  const doc = await prisma.doc.findUnique({ where: { id: docId }, select: { workspaceId: true, projectId: true, teamId: true } });
  if (!doc) throw new NotFoundError("Doc not found");
  await assertDocScopeAccess(userId, doc.workspaceId, doc);

  return prisma.doc.update({
    where: { id: docId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.content !== undefined && { content: input.content as Prisma.InputJsonValue }),
      ...(input.parentId !== undefined && { parentId: input.parentId }),
      ...(input.position !== undefined && { position: input.position }),
    },
  });
}

export async function deleteDoc(docId: string, userId: string) {
  const doc = await prisma.doc.findUnique({ where: { id: docId }, select: { workspaceId: true, projectId: true, teamId: true } });
  if (!doc) throw new NotFoundError("Doc not found");
  await assertDocScopeAccess(userId, doc.workspaceId, doc);
  await prisma.doc.delete({ where: { id: docId } });
}
