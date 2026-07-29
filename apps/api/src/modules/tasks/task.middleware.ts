import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { assertProjectRole } from "../../lib/access";
import { NotFoundError, UnauthorizedError } from "../../lib/errors";

/** Resolves :taskId (or a custom param/lookup) to its project and enforces project role. */
export function requireTaskProjectAccess(minRole: Role = "GUEST", paramName = "taskId") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    const task = await prisma.task.findUnique({ where: { id: req.params[paramName] } });
    if (!task) throw new NotFoundError("Task not found");

    req.projectRole = await assertProjectRole(req.user.id, task.projectId, minRole);
    req.params.projectId = task.projectId;
    next();
  };
}

/** Generic: resolves a sub-resource id (:id) to its taskId via `findTaskId`, then to
 * that task's project, and enforces project role. Used for comments/checklists/
 * checklist-items/time-entries/dependencies which don't carry :taskId in their path. */
export function requireTaskAccessVia(findTaskId: (id: string) => Promise<string | null>, minRole: Role = "GUEST") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    const taskId = await findTaskId(req.params.id);
    if (!taskId) throw new NotFoundError("Resource not found");
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError("Task not found");

    req.projectRole = await assertProjectRole(req.user.id, task.projectId, minRole);
    next();
  };
}

export const viaComment = async (id: string) => (await prisma.comment.findUnique({ where: { id } }))?.taskId ?? null;
export const viaChecklist = async (id: string) => (await prisma.checklist.findUnique({ where: { id } }))?.taskId ?? null;
export const viaChecklistItem = async (id: string) => {
  const item = await prisma.checklistItem.findUnique({ where: { id }, include: { checklist: true } });
  return item?.checklist.taskId ?? null;
};
export const viaTimeEntry = async (id: string) => (await prisma.timeEntry.findUnique({ where: { id } }))?.taskId ?? null;
export const viaDependency = async (id: string) => (await prisma.taskDependency.findUnique({ where: { id } }))?.taskId ?? null;
