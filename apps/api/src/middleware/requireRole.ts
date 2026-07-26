import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { ROLE_RANK } from "@repo/shared-types";
import { prisma } from "../lib/prisma";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      workspaceRole?: Role;
      projectRole?: Role;
    }
  }
}

/** Loads the caller's WorkspaceMember row for :workspaceId and enforces a minimum role rank. */
export function requireWorkspaceRole(minRole: Role) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    const workspaceId = req.params.workspaceId;
    if (!workspaceId) throw new ForbiddenError("Missing workspaceId");

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
    });
    if (!membership) throw new ForbiddenError("Not a member of this workspace");
    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenError(`Requires role ${minRole} or higher`);
    }
    req.workspaceRole = membership.role;
    next();
  };
}

/** Loads the caller's ProjectMember row for :projectId and enforces a minimum role rank. */
export function requireProjectMember(minRole: Role = "GUEST") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    const projectId = req.params.projectId;
    if (!projectId) throw new ForbiddenError("Missing projectId");

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user.id } },
    });
    if (!membership) throw new ForbiddenError("Not a member of this project");
    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenError(`Requires role ${minRole} or higher`);
    }
    req.projectRole = membership.role;
    next();
  };
}
