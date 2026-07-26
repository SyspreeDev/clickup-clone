import type { Request, Response } from "express";
import * as taskService from "./task.service";
import * as checklistService from "./checklist.service";
import * as commentService from "./comment.service";

export async function list(req: Request, res: Response) {
  res.json(await taskService.listTasks(req.params.projectId, req.query as never));
}
export async function get(req: Request, res: Response) {
  res.json(await taskService.getTask(req.params.taskId));
}
export async function create(req: Request, res: Response) {
  res.status(201).json(await taskService.createTask(req.params.projectId, req.user!.id, req.body));
}
export async function update(req: Request, res: Response) {
  res.json(await taskService.updateTask(req.params.taskId, req.body, req.user!.id));
}
export async function move(req: Request, res: Response) {
  res.json(await taskService.moveTask(req.params.taskId, req.body, req.user!.id));
}
export async function remove(req: Request, res: Response) {
  await taskService.deleteTask(req.params.taskId);
  res.status(204).send();
}

export async function addAssignee(req: Request, res: Response) {
  res.json(await taskService.addAssignee(req.params.taskId, req.params.userId ?? req.body.userId, req.user!.id));
}
export async function removeAssignee(req: Request, res: Response) {
  res.json(await taskService.removeAssignee(req.params.taskId, req.params.userId, req.user!.id));
}
export async function addLabel(req: Request, res: Response) {
  res.json(await taskService.addLabel(req.params.taskId, req.params.labelId));
}
export async function removeLabel(req: Request, res: Response) {
  res.json(await taskService.removeLabel(req.params.taskId, req.params.labelId));
}

export async function listSubtasks(req: Request, res: Response) {
  res.json(await taskService.listSubtasks(req.params.taskId));
}
export async function createSubtask(req: Request, res: Response) {
  res.status(201).json(await taskService.createSubtask(req.params.taskId, req.user!.id, req.body));
}

export async function addDependency(req: Request, res: Response) {
  res.status(201).json(await taskService.addDependency(req.params.taskId, req.body, req.user!.id));
}
export async function removeDependency(req: Request, res: Response) {
  await taskService.removeDependency(req.params.id);
  res.status(204).send();
}

export async function listActivity(req: Request, res: Response) {
  res.json(await taskService.listActivity(req.params.taskId));
}

export async function listTimeEntries(req: Request, res: Response) {
  res.json(await taskService.listTimeEntries(req.params.taskId));
}
export async function createTimeEntry(req: Request, res: Response) {
  res.status(201).json(await taskService.createTimeEntry(req.params.taskId, req.user!.id, req.body));
}
export async function deleteTimeEntry(req: Request, res: Response) {
  await taskService.deleteTimeEntry(req.params.id);
  res.status(204).send();
}

export async function myTasks(req: Request, res: Response) {
  res.json(await taskService.listMyTasks(req.user!.id, req.query.workspaceId as string | undefined));
}

// Checklists
export async function createChecklist(req: Request, res: Response) {
  res.status(201).json(await checklistService.createChecklist(req.params.taskId, req.body));
}
export async function updateChecklist(req: Request, res: Response) {
  res.json(await checklistService.updateChecklist(req.params.id, req.body.title));
}
export async function deleteChecklist(req: Request, res: Response) {
  await checklistService.deleteChecklist(req.params.id);
  res.status(204).send();
}
export async function addChecklistItem(req: Request, res: Response) {
  res.status(201).json(await checklistService.addItem(req.params.id, req.body));
}
export async function updateChecklistItem(req: Request, res: Response) {
  res.json(await checklistService.updateItem(req.params.id, req.body));
}
export async function deleteChecklistItem(req: Request, res: Response) {
  await checklistService.deleteItem(req.params.id);
  res.status(204).send();
}

// Comments
export async function listComments(req: Request, res: Response) {
  const task = await taskService.getTask(req.params.taskId);
  res.json(task.comments);
}
export async function createComment(req: Request, res: Response) {
  res.status(201).json(await commentService.createComment(req.params.taskId, req.user!.id, req.body));
}
export async function updateComment(req: Request, res: Response) {
  res.json(await commentService.updateComment(req.params.id, req.user!.id, req.body.content));
}
export async function deleteComment(req: Request, res: Response) {
  await commentService.deleteComment(req.params.id, req.user!.id);
  res.status(204).send();
}
