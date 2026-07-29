import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { ROLE_RANK } from "@repo/shared-types";
import { prisma } from "../lib/prisma";
import { assertProjectRole } from "../lib/access";
import { asyncHandler } from "../lib/asyncHandler";
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

// NOTE: these are wrapped in asyncHandler because Express 4 does not catch
// rejections from async middleware — an unhandled throw here takes the whole
// process down rather than returning 403.

/** Loads the caller's WorkspaceMember row for :workspaceId and enforces a minimum role rank. */
export function requireWorkspaceRole(minRole: Role) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
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
  });
}

/**
 * Enforces a minimum role on :projectId using the *effective* role from
 * `resolveProjectRole`, so workspace managers and whole-team membership are
 * honoured — not only people added to the project one by one.
 */
export function requireProjectMember(minRole: Role = "GUEST") {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    const projectId = req.params.projectId;
    if (!projectId) throw new ForbiddenError("Missing projectId");

    req.projectRole = await assertProjectRole(req.user.id, projectId, minRole);
    next();
  });
}
