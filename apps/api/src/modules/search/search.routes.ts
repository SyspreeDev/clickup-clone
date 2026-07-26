import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireWorkspaceRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import { search } from "./search.service";

export const searchRouter: Router = Router();
searchRouter.use(authenticate);

searchRouter.get(
  "/workspaces/:workspaceId/search",
  requireWorkspaceRole("GUEST"),
  asyncHandler(async (req, res) => {
    res.json(await search(req.params.workspaceId, (req.query.q as string) ?? ""));
  }),
);
