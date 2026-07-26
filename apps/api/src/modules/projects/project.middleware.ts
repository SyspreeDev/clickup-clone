import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { ROLE_RANK } from "@repo/shared-types";
import { prisma } from "../../lib/prisma";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../lib/errors";

/** For routes keyed by a sub-resource id (workflow state / label / milestone) that
 * don't carry :projectId directly — resolves the parent project and enforces role. */
export function requireProjectAccessVia(
  resolveProjectId: (req: Request) => Promise<string | null>,
  minRole: Role = "MEMBER",
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    const projectId = await resolveProjectId(req);
    if (!projectId) throw new NotFoundError("Resource not found");

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user.id } },
    });
    if (!membership) throw new ForbiddenError("Not a member of this project");
    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenError(`Requires role ${minRole} or higher`);
    }
    req.params.projectId = projectId;
    next();
  };
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
