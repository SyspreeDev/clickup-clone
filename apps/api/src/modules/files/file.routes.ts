import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/authenticate";
import { requireWorkspaceRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import * as controller from "./file.controller";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const fileRouter: Router = Router();
fileRouter.use(authenticate);

fileRouter.get("/workspaces/:workspaceId/folders", requireWorkspaceRole("GUEST"), asyncHandler(controller.listFolders));
fileRouter.post("/workspaces/:workspaceId/folders", requireWorkspaceRole("MEMBER"), asyncHandler(controller.createFolder));

fileRouter.get("/workspaces/:workspaceId/files", requireWorkspaceRole("GUEST"), asyncHandler(controller.listFiles));
fileRouter.post(
  "/workspaces/:workspaceId/files",
  requireWorkspaceRole("MEMBER"),
  upload.single("file"),
  asyncHandler(controller.uploadFile),
);
fileRouter.delete("/files/:id", authenticate, asyncHandler(controller.deleteFile));
