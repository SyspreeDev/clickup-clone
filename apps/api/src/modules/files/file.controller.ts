import type { Request, Response } from "express";
import { BadRequestError } from "../../lib/errors";
import * as fileService from "./file.service";

export async function listFolders(req: Request, res: Response) {
  res.json(await fileService.listFolders(req.params.workspaceId, (req.query.parentId as string) ?? null));
}
export async function createFolder(req: Request, res: Response) {
  res
    .status(201)
    .json(await fileService.createFolder(req.params.workspaceId, req.user!.id, req.body.name, req.body.parentId ?? null));
}

export async function listFiles(req: Request, res: Response) {
  res.json(await fileService.listFiles(req.params.workspaceId, (req.query.folderId as string) ?? null));
}
export async function uploadFile(req: Request, res: Response) {
  if (!req.file) throw new BadRequestError("No file uploaded");
  const file = await fileService.uploadFile(
    req.params.workspaceId,
    req.user!.id,
    req.file,
    (req.body.folderId as string) || null,
    (req.body.projectId as string) || null,
  );
  res.status(201).json(file);
}
export async function presignUpload(req: Request, res: Response) {
  const { filename, contentType } = req.body as { filename?: string; contentType?: string };
  if (!filename || !contentType) throw new BadRequestError("filename and contentType are required");
  const presigned = await fileService.presignUpload(filename, contentType);
  if (!presigned) {
    res.status(501).json({
      error: { code: "STORAGE_PRESIGN_UNSUPPORTED", message: "Direct upload is not supported by the current storage provider" },
    });
    return;
  }
  res.json(presigned);
}

export async function completeUpload(req: Request, res: Response) {
  const { key, name, size, mimeType } = req.body as { key?: string; name?: string; size?: number; mimeType?: string };
  if (!key || !name || !size || !mimeType) throw new BadRequestError("key, name, size, and mimeType are required");
  const file = await fileService.completeUpload(
    req.params.workspaceId,
    req.user!.id,
    { key, name, size, mimeType },
    (req.body.folderId as string) || null,
    (req.body.projectId as string) || null,
  );
  res.status(201).json(file);
}

export async function downloadFile(req: Request, res: Response) {
  const file = await fileService.readFileForUser(req.params.id, req.user!.id);
  res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.name)}"`);
  res.send(file.buffer);
}

export async function deleteFile(req: Request, res: Response) {
  await fileService.deleteFile(req.params.id);
  res.status(204).send();
}
