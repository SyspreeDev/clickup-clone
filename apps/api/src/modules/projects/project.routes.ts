import { Router } from "express";
import {
  createProjectSchema,
  updateProjectSchema,
  createLabelSchema,
  createMilestoneSchema,
  createWorkflowStateSchema,
} from "@repo/shared-types";
import { authenticate } from "../../middleware/authenticate";
import { requireWorkspaceRole, requireProjectMember } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireProjectAccessVia, viaWorkflowState, viaLabel, viaMilestone } from "./project.middleware";
import * as controller from "./project.controller";

export const projectRouter: Router = Router();

projectRouter.use(authenticate);

projectRouter.post(
  "/workspaces/:workspaceId/projects",
  requireWorkspaceRole("MEMBER"),
  validateBody(createProjectSchema),
  asyncHandler(controller.create),
);
projectRouter.get("/workspaces/:workspaceId/projects", requireWorkspaceRole("GUEST"), asyncHandler(controller.list));

projectRouter.get("/projects/:projectId", requireProjectMember("GUEST"), asyncHandler(controller.get));
projectRouter.patch(
  "/projects/:projectId",
  requireProjectMember("TEAM_LEAD"),
  validateBody(updateProjectSchema),
  asyncHandler(controller.update),
);
projectRouter.delete("/projects/:projectId", requireProjectMember("ADMIN"), asyncHandler(controller.remove));

projectRouter.post("/projects/:projectId/members", requireProjectMember("TEAM_LEAD"), asyncHandler(controller.addMember));
projectRouter.delete("/projects/:projectId/members/:userId", requireProjectMember("TEAM_LEAD"), asyncHandler(controller.removeMember));

projectRouter.get("/projects/:projectId/workflow-states", requireProjectMember("GUEST"), asyncHandler(controller.listWorkflowStates));
projectRouter.post(
  "/projects/:projectId/workflow-states",
  requireProjectMember("TEAM_LEAD"),
  validateBody(createWorkflowStateSchema),
  asyncHandler(controller.createWorkflowState),
);
projectRouter.patch(
  "/workflow-states/:id",
  requireProjectAccessVia(viaWorkflowState, "TEAM_LEAD"),
  asyncHandler(controller.updateWorkflowState),
);
projectRouter.delete(
  "/workflow-states/:id",
  requireProjectAccessVia(viaWorkflowState, "TEAM_LEAD"),
  asyncHandler(controller.deleteWorkflowState),
);

projectRouter.get("/projects/:projectId/labels", requireProjectMember("GUEST"), asyncHandler(controller.listLabels));
projectRouter.post(
  "/projects/:projectId/labels",
  requireProjectMember("MEMBER"),
  validateBody(createLabelSchema),
  asyncHandler(controller.createLabel),
);
projectRouter.patch("/labels/:id", requireProjectAccessVia(viaLabel, "MEMBER"), asyncHandler(controller.updateLabel));
projectRouter.delete("/labels/:id", requireProjectAccessVia(viaLabel, "MEMBER"), asyncHandler(controller.deleteLabel));

projectRouter.get("/projects/:projectId/milestones", requireProjectMember("GUEST"), asyncHandler(controller.listMilestones));
projectRouter.post(
  "/projects/:projectId/milestones",
  requireProjectMember("MEMBER"),
  validateBody(createMilestoneSchema),
  asyncHandler(controller.createMilestone),
);
projectRouter.patch(
  "/milestones/:id",
  requireProjectAccessVia(viaMilestone, "MEMBER"),
  asyncHandler(controller.updateMilestone),
);
projectRouter.delete(
  "/milestones/:id",
  requireProjectAccessVia(viaMilestone, "MEMBER"),
  asyncHandler(controller.deleteMilestone),
);
