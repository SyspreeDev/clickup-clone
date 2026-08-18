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
// Direct-to-storage upload: presign issues a short-lived PUT URL, the browser
// uploads straight to it, then complete records the File row. Same MEMBER
// guard as the buffered route above — these two calls replace it, not extend it.
fileRouter.post("/workspaces/:workspaceId/files/presign", requireWorkspaceRole("MEMBER"), asyncHandler(controller.presignUpload));
fileRouter.post("/workspaces/:workspaceId/files/complete", requireWorkspaceRole("MEMBER"), asyncHandler(controller.completeUpload));
// Access is decided per file — by its list if it has one, otherwise by
// workspace membership — so there is no route-level role guard here.
fileRouter.get("/files/:id/download", asyncHandler(controller.downloadFile));
fileRouter.delete("/files/:id", authenticate, asyncHandler(controller.deleteFile));
