import type { Request, Response } from "express";
import * as teamService from "./team.service";

export async function create(req: Request, res: Response) {
  if (!req.user) return;
  const team = await teamService.createTeam(req.params.workspaceId, req.user.id, req.body);
  res.status(201).json(team);
}

export async function list(req: Request, res: Response) {
  const teams = await teamService.listTeams(req.params.workspaceId);
  res.json(teams);
}

export async function get(req: Request, res: Response) {
  const team = await teamService.getTeam(req.params.teamId);
  res.json(team);
}

export async function update(req: Request, res: Response) {
  const team = await teamService.updateTeam(req.params.teamId, req.body);
  res.json(team);
}

export async function remove(req: Request, res: Response) {
  await teamService.deleteTeam(req.params.teamId);
  res.status(204).send();
}

export async function addMember(req: Request, res: Response) {
  const member = await teamService.addMember(req.params.teamId, req.body);
  res.status(201).json(member);
}

export async function removeMember(req: Request, res: Response) {
  await teamService.removeMember(req.params.teamId, req.params.userId);
  res.status(204).send();
}
