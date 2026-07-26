import { prisma } from "../../lib/prisma";
import { storageProvider } from "../../lib/storage";
import { NotFoundError } from "../../lib/errors";

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

export async function deleteFile(id: string) {
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) throw new NotFoundError("File not found");
  await prisma.file.delete({ where: { id } });
}
