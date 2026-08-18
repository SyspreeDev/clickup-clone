import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import * as workspaceService from "./workspace.service";

export async function create(req: Request, res: Response) {
  if (!req.user) return;
  const workspace = await workspaceService.createWorkspace(req.user.id, req.body);
  res.status(201).json(workspace);
}

export async function list(req: Request, res: Response) {
  if (!req.user) return;
  const workspaces = await workspaceService.listMyWorkspaces(req.user.id);
  res.json(workspaces);
}

export async function get(req: Request, res: Response) {
  const workspace = await workspaceService.getWorkspace(req.params.workspaceId);
  res.json(workspace);
}

export async function update(req: Request, res: Response) {
  const workspace = await workspaceService.updateWorkspace(req.params.workspaceId, req.body);
  res.json(workspace);
}

export async function remove(req: Request, res: Response) {
  await workspaceService.deleteWorkspace(req.params.workspaceId);
  res.status(204).send();
}

export async function listMembers(req: Request, res: Response) {
  const members = await workspaceService.listMembers(req.params.workspaceId);
  res.json(members);
}

export async function invite(req: Request, res: Response) {
  const inviter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } });
  const member = await workspaceService.inviteMember(req.params.workspaceId, req.body, inviter?.name ?? "A teammate");
  res.status(201).json(member);
}

export async function updateMemberRole(req: Request, res: Response) {
  const member = await workspaceService.updateMemberRole(req.params.workspaceId, req.params.memberId, req.body.role);
  res.json(member);
}

export async function removeMember(req: Request, res: Response) {
  await workspaceService.removeMember(req.params.workspaceId, req.params.memberId);
  res.status(204).send();
}

export async function dashboard(req: Request, res: Response) {
  if (!req.user) return;
  const data = await workspaceService.getDashboard(req.params.workspaceId, req.user.id);
  res.json(data);
}

export async function allTasks(req: Request, res: Response) {
  const data = await workspaceService.listAllTasks(req.params.workspaceId);
  res.json(data);
}
