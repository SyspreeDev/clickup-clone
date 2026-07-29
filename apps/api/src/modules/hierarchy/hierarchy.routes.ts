import { Router } from "express";
import {
  createProjectFolderSchema,
  updateProjectFolderSchema,
  moveProjectSchema,
  createDocSchema,
  updateDocSchema,
} from "@repo/shared-types";
import { authenticate } from "../../middleware/authenticate";
import { requireWorkspaceRole, requireProjectMember } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireFolderWorkspaceAccess } from "./hierarchy.middleware";
import * as svc from "./hierarchy.service";

export const hierarchyRouter: Router = Router();
hierarchyRouter.use(authenticate);

// ── Sidebar tree: spaces → folders → lists, pre-filtered by access ──
hierarchyRouter.get(
  "/workspaces/:workspaceId/tree",
  requireWorkspaceRole("GUEST"),
  asyncHandler(async (req, res) => {
    res.json(await svc.getSidebarTree(req.params.workspaceId, req.user!.id));
  }),
);

// ── Folders ──
hierarchyRouter.post(
  "/workspaces/:workspaceId/list-folders",
  requireWorkspaceRole("TEAM_LEAD"),
  validateBody(createProjectFolderSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await svc.createFolder(req.params.workspaceId, req.user!.id, req.body));
  }),
);
hierarchyRouter.patch(
  "/list-folders/:folderId",
  requireFolderWorkspaceAccess("TEAM_LEAD"),
  validateBody(updateProjectFolderSchema),
  asyncHandler(async (req, res) => {
    res.json(await svc.updateFolder(req.params.folderId, req.body));
  }),
);
hierarchyRouter.delete(
  "/list-folders/:folderId",
  requireFolderWorkspaceAccess("TEAM_LEAD"),
  asyncHandler(async (req, res) => {
    await svc.deleteFolder(req.params.folderId);
    res.status(204).send();
  }),
);

// ── Move a list between folders/spaces ──
hierarchyRouter.patch(
  "/projects/:projectId/move",
  requireProjectMember("TEAM_LEAD"),
  validateBody(moveProjectSchema),
  asyncHandler(async (req, res) => {
    res.json(await svc.moveProject(req.params.projectId, req.body));
  }),
);

// ── Docs ──
hierarchyRouter.get(
  "/workspaces/:workspaceId/docs",
  requireWorkspaceRole("GUEST"),
  asyncHandler(async (req, res) => {
    res.json(
      await svc.listDocs(req.params.workspaceId, req.user!.id, {
        projectId: (req.query.projectId as string) || undefined,
        teamId: (req.query.teamId as string) || undefined,
      }),
    );
  }),
);
hierarchyRouter.post(
  "/workspaces/:workspaceId/docs",
  requireWorkspaceRole("MEMBER"),
  validateBody(createDocSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await svc.createDoc(req.params.workspaceId, req.user!.id, req.body));
  }),
);
hierarchyRouter.get(
  "/docs/:docId",
  asyncHandler(async (req, res) => {
    res.json(await svc.getDoc(req.params.docId, req.user!.id));
  }),
);
hierarchyRouter.patch(
  "/docs/:docId",
  validateBody(updateDocSchema),
  asyncHandler(async (req, res) => {
    res.json(await svc.updateDoc(req.params.docId, req.user!.id, req.body));
  }),
);
hierarchyRouter.delete(
  "/docs/:docId",
  asyncHandler(async (req, res) => {
    await svc.deleteDoc(req.params.docId, req.user!.id);
    res.status(204).send();
  }),
);
