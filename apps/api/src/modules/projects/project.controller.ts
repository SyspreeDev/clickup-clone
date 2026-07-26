import type { Request, Response } from "express";
import * as projectService from "./project.service";

export async function create(req: Request, res: Response) {
  if (!req.user) return;
  const project = await projectService.createProject(req.params.workspaceId, req.user.id, req.body);
  res.status(201).json(project);
}

export async function list(req: Request, res: Response) {
  const projects = await projectService.listProjects(req.params.workspaceId, {
    teamId: req.query.teamId as string | undefined,
    status: req.query.status as string | undefined,
  });
  res.json(projects);
}

export async function get(req: Request, res: Response) {
  const project = await projectService.getProject(req.params.projectId);
  res.json(project);
}

export async function update(req: Request, res: Response) {
  const project = await projectService.updateProject(req.params.projectId, req.body);
  res.json(project);
}

export async function remove(req: Request, res: Response) {
  await projectService.archiveProject(req.params.projectId);
  res.status(204).send();
}

export async function addMember(req: Request, res: Response) {
  const member = await projectService.addMember(req.params.projectId, req.body.userId, req.body.role ?? "MEMBER");
  res.status(201).json(member);
}

export async function removeMember(req: Request, res: Response) {
  await projectService.removeMember(req.params.projectId, req.params.userId);
  res.status(204).send();
}

export async function listWorkflowStates(req: Request, res: Response) {
  res.json(await projectService.listWorkflowStates(req.params.projectId));
}
export async function createWorkflowState(req: Request, res: Response) {
  res.status(201).json(await projectService.createWorkflowState(req.params.projectId, req.body));
}
export async function updateWorkflowState(req: Request, res: Response) {
  res.json(await projectService.updateWorkflowState(req.params.id, req.body));
}
export async function deleteWorkflowState(req: Request, res: Response) {
  await projectService.deleteWorkflowState(req.params.id);
  res.status(204).send();
}

export async function listLabels(req: Request, res: Response) {
  res.json(await projectService.listLabels(req.params.projectId));
}
export async function createLabel(req: Request, res: Response) {
  res.status(201).json(await projectService.createLabel(req.params.projectId, req.body));
}
export async function updateLabel(req: Request, res: Response) {
  res.json(await projectService.updateLabel(req.params.id, req.body));
}
export async function deleteLabel(req: Request, res: Response) {
  await projectService.deleteLabel(req.params.id);
  res.status(204).send();
}

export async function listMilestones(req: Request, res: Response) {
  res.json(await projectService.listMilestones(req.params.projectId));
}
export async function createMilestone(req: Request, res: Response) {
  res.status(201).json(await projectService.createMilestone(req.params.projectId, req.body));
}
export async function updateMilestone(req: Request, res: Response) {
  res.json(await projectService.updateMilestone(req.params.id, req.body));
}
export async function deleteMilestone(req: Request, res: Response) {
  await projectService.deleteMilestone(req.params.id);
  res.status(204).send();
}
