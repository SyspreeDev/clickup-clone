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
  conversationId: z.string().optional(),
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

aiRouter.get(
  "/workspaces/:workspaceId/ai/conversations",
  requireWorkspaceRole("GUEST"),
  asyncHandler(async (req, res) => {
    res.json(await aiService.listConversations({ userId: req.user!.id, workspaceId: req.params.workspaceId }));
  }),
);

aiRouter.get(
  "/workspaces/:workspaceId/ai/conversations/:conversationId",
  requireWorkspaceRole("GUEST"),
  asyncHandler(async (req, res) => {
    const messages = await aiService.getConversationMessages(
      { userId: req.user!.id, workspaceId: req.params.workspaceId },
      req.params.conversationId,
    );
    res.json(messages);
  }),
);

aiRouter.delete(
  "/workspaces/:workspaceId/ai/conversations/:conversationId",
  requireWorkspaceRole("GUEST"),
  asyncHandler(async (req, res) => {
    await aiService.deleteConversation({ userId: req.user!.id, workspaceId: req.params.workspaceId }, req.params.conversationId);
    res.status(204).send();
  }),
);

// Server-Sent Events — the frontend reads this with a manual fetch + stream
// reader (not EventSource, since this is a POST with a body). Errors that
// happen *after* headers are sent are written as an `error` event rather than
// passed to the global error handler, which can no longer set the status code.
aiRouter.post(
  "/workspaces/:workspaceId/ai/chat",
  requireWorkspaceRole("GUEST"),
  validateBody(chatSchema),
  asyncHandler(async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      for await (const event of aiService.streamChat(
        { userId: req.user!.id, workspaceId: req.params.workspaceId },
        req.body,
      )) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." })}\n\n`);
    } finally {
      res.end();
    }
  }),
);
