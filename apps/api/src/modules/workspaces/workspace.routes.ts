import { Router } from "express";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from "@repo/shared-types";
import { authenticate } from "../../middleware/authenticate";
import { requireWorkspaceRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";
import * as controller from "./workspace.controller";

export const workspaceRouter: Router = Router();

workspaceRouter.use(authenticate);

workspaceRouter.post("/workspaces", validateBody(createWorkspaceSchema), asyncHandler(controller.create));
workspaceRouter.get("/workspaces", asyncHandler(controller.list));
workspaceRouter.get("/workspaces/:workspaceId", requireWorkspaceRole("GUEST"), asyncHandler(controller.get));
workspaceRouter.patch(
  "/workspaces/:workspaceId",
  requireWorkspaceRole("ADMIN"),
  validateBody(updateWorkspaceSchema),
  asyncHandler(controller.update),
);
workspaceRouter.delete("/workspaces/:workspaceId", requireWorkspaceRole("OWNER"), asyncHandler(controller.remove));

workspaceRouter.get("/workspaces/:workspaceId/members", requireWorkspaceRole("GUEST"), asyncHandler(controller.listMembers));
workspaceRouter.post(
  "/workspaces/:workspaceId/members/invite",
  requireWorkspaceRole("ADMIN"),
  validateBody(inviteMemberSchema),
  asyncHandler(controller.invite),
);
workspaceRouter.patch(
  "/workspaces/:workspaceId/members/:memberId",
  requireWorkspaceRole("ADMIN"),
  validateBody(updateMemberRoleSchema),
  asyncHandler(controller.updateMemberRole),
);
workspaceRouter.delete(
  "/workspaces/:workspaceId/members/:memberId",
  requireWorkspaceRole("ADMIN"),
  asyncHandler(controller.removeMember),
);

workspaceRouter.get("/workspaces/:workspaceId/dashboard", requireWorkspaceRole("GUEST"), asyncHandler(controller.dashboard));
