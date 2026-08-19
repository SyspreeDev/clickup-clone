import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { requireWorkspaceRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";
import { isAiConfigured } from "../../config/env";
import * as aiService from "./ai.service";

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20)
    .optional(),
});

export const aiRouter: Router = Router();
aiRouter.use(authenticate);

aiRouter.get(
  "/workspaces/:workspaceId/ai/status",
  requireWorkspaceRole("GUEST"),
  asyncHandler(async (_req, res) => {
    res.json({ configured: isAiConfigured });
  }),
);

aiRouter.post(
  "/workspaces/:workspaceId/ai/chat",
  requireWorkspaceRole("GUEST"),
  validateBody(chatSchema),
  asyncHandler(async (req, res) => {
    const result = await aiService.chat(
      { userId: req.user!.id, workspaceId: req.params.workspaceId },
      req.body.message,
      req.body.history ?? [],
    );
    res.json(result);
  }),
);
