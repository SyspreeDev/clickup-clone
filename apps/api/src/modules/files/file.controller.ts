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
export async function deleteFile(req: Request, res: Response) {
  await fileService.deleteFile(req.params.id);
  res.status(204).send();
}
