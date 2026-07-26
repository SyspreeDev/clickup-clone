import { Router } from "express";
import { createTeamSchema, updateTeamSchema, addTeamMemberSchema } from "@repo/shared-types";
import { authenticate } from "../../middleware/authenticate";
import { requireWorkspaceRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireTeamWorkspaceAccess } from "./team.middleware";
import * as controller from "./team.controller";

export const teamRouter: Router = Router();

teamRouter.use(authenticate);

teamRouter.post(
  "/workspaces/:workspaceId/teams",
  requireWorkspaceRole("MEMBER"),
  validateBody(createTeamSchema),
  asyncHandler(controller.create),
);
teamRouter.get("/workspaces/:workspaceId/teams", requireWorkspaceRole("GUEST"), asyncHandler(controller.list));

teamRouter.get("/teams/:teamId", requireTeamWorkspaceAccess("GUEST"), asyncHandler(controller.get));
teamRouter.patch(
  "/teams/:teamId",
  requireTeamWorkspaceAccess("TEAM_LEAD"),
  validateBody(updateTeamSchema),
  asyncHandler(controller.update),
);
teamRouter.delete("/teams/:teamId", requireTeamWorkspaceAccess("ADMIN"), asyncHandler(controller.remove));

teamRouter.post(
  "/teams/:teamId/members",
  requireTeamWorkspaceAccess("TEAM_LEAD"),
  validateBody(addTeamMemberSchema),
  asyncHandler(controller.addMember),
);
teamRouter.delete("/teams/:teamId/members/:userId", requireTeamWorkspaceAccess("TEAM_LEAD"), asyncHandler(controller.removeMember));
