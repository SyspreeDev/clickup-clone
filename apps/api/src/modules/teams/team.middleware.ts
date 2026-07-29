import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../lib/errors";
import { ROLE_RANK } from "@repo/shared-types";
import type { Role } from "@prisma/client";

/** For routes keyed by :teamId (no :workspaceId in the path) — resolves the team's
 * workspace and enforces the caller's workspace role. */
export function requireTeamWorkspaceAccess(minRole: Role = "MEMBER") {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    const team = await prisma.team.findUnique({ where: { id: req.params.teamId } });
    if (!team) throw new NotFoundError("Team not found");

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: team.workspaceId, userId: req.user.id } },
    });
    if (!membership) throw new ForbiddenError("Not a member of this workspace");
    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenError(`Requires role ${minRole} or higher`);
    }
    next();
  });
}
