import { prisma } from "../../lib/prisma";
import { storageProvider } from "../../lib/storage";
import { resolveProjectRole } from "../../lib/access";
import { ForbiddenError, NotFoundError } from "../../lib/errors";

export async function listFolders(workspaceId: string, parentId: string | null) {
  return prisma.folder.findMany({
    where: { workspaceId, parentId },
    orderBy: { name: "asc" },
  });
}

export async function createFolder(workspaceId: string, creatorId: string, name: string, parentId: string | null) {
  return prisma.folder.create({ data: { workspaceId, name, parentId, createdById: creatorId } });
}

export async function listFiles(workspaceId: string, folderId: string | null) {
  return prisma.file.findMany({
    where: { workspaceId, folderId },
    include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function uploadFile(
  workspaceId: string,
  uploaderId: string,
  file: { originalname: string; buffer: Buffer; size: number; mimetype: string },
  folderId: string | null,
  projectId: string | null,
) {
  const stored = await storageProvider.save(file.originalname, file.buffer);
  return prisma.file.create({
    data: {
      workspaceId,
      folderId,
      projectId,
      name: file.originalname,
      url: stored.url,
      size: file.size,
      mimeType: file.mimetype,
      uploadedById: uploaderId,
    },
    include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

/**
 * Direct-to-storage upload, step 1: hand the browser a short-lived URL it can
 * PUT the file bytes to itself. Only meaningful when the active storage
 * provider supports it (R2) — callers must fall back to the buffered
 * multipart route otherwise.
 */
export async function presignUpload(originalName: string, contentType: string) {
  if (!storageProvider.presignUpload) return null;
  return storageProvider.presignUpload(originalName, contentType);
}

/**
 * Direct-to-storage upload, step 2: the browser already PUT the bytes to the
 * key from presignUpload, so this just records the File row — no buffer
 * passes through our server at all.
 */
export async function completeUpload(
  workspaceId: string,
  uploaderId: string,
  input: { key: string; name: string; size: number; mimeType: string },
  folderId: string | null,
  projectId: string | null,
) {
  return prisma.file.create({
    data: {
      workspaceId,
      folderId,
      projectId,
      name: input.name,
      url: storageProvider.resolveUrl(input.key),
      size: input.size,
      mimeType: input.mimeType,
      uploadedById: uploaderId,
    },
    include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function deleteFile(id: string) {
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) throw new NotFoundError("File not found");
  await prisma.file.delete({ where: { id } });
}

/**
 * Serves a stored file only to someone entitled to see it. Uploads were
 * previously exposed by a bare express.static mount, which left every client's
 * documents readable by anyone holding the URL — no use at all alongside
 * team-scoped lists and single-list client guests.
 */
export async function readFileForUser(id: string, userId: string) {
  const file = await prisma.file.findUnique({
    where: { id },
    select: { name: true, url: true, mimeType: true, workspaceId: true, projectId: true },
  });
  if (!file) throw new NotFoundError("File not found");

  if (file.projectId) {
    // Filed against a client's list, so that list's own rules decide.
    const role = await resolveProjectRole(userId, file.projectId);
    if (!role) throw new ForbiddenError("You do not have access to this file");
  } else {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: file.workspaceId, userId } },
      select: { status: true },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenError("You do not have access to this file");
    }
  }

  const key = file.url.replace(/^\/uploads\//, "");
  return { ...file, buffer: await storageProvider.read(key) };
}
