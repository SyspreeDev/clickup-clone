import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { assertProjectRole } from "../../lib/access";
import { asyncHandler } from "../../lib/asyncHandler";
import { NotFoundError, UnauthorizedError } from "../../lib/errors";

/** For routes keyed by a sub-resource id (workflow state / label / milestone) that
 * don't carry :projectId directly — resolves the parent project and enforces role. */
export function requireProjectAccessVia(
  resolveProjectId: (req: Request) => Promise<string | null>,
  minRole: Role = "MEMBER",
) {
  // asyncHandler: Express 4 does not catch async middleware rejections, so a
  // bare throw here would crash the process instead of returning 403/404.
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    const projectId = await resolveProjectId(req);
    if (!projectId) throw new NotFoundError("Resource not found");

    req.projectRole = await assertProjectRole(req.user.id, projectId, minRole);
    req.params.projectId = projectId;
    next();
  });
}

export const viaWorkflowState = async (req: Request) => {
  const state = await prisma.workflowState.findUnique({ where: { id: req.params.id } });
  return state?.projectId ?? null;
};

export const viaLabel = async (req: Request) => {
  const label = await prisma.label.findUnique({ where: { id: req.params.id } });
  return label?.projectId ?? null;
};

export const viaMilestone = async (req: Request) => {
  const milestone = await prisma.milestone.findUnique({ where: { id: req.params.id } });
  return milestone?.projectId ?? null;
};
