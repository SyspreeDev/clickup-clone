import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { ROLE_RANK } from "@repo/shared-types";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../lib/errors";

/**
 * For folder routes keyed by :folderId with no :workspaceId in the path —
 * resolves the folder's workspace and enforces the caller's workspace role.
 * Wrapped in asyncHandler because Express 4 does not catch async rejections.
 */
export function requireFolderWorkspaceAccess(minRole: Role = "TEAM_LEAD") {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    const folder = await prisma.projectFolder.findUnique({
      where: { id: req.params.folderId },
      select: { workspaceId: true },
    });
    if (!folder) throw new NotFoundError("Folder not found");

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: folder.workspaceId, userId: req.user.id } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenError("Not a member of this workspace");
    }
    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenError(`Requires role ${minRole} or higher`);
    }
    req.workspaceRole = membership.role;
    next();
  });
}
