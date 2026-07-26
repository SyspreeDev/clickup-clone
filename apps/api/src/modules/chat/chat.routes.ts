import { Router } from "express";
import { createChannelSchema, createMessageSchema, addReactionSchema } from "@repo/shared-types";
import { authenticate } from "../../middleware/authenticate";
import { requireWorkspaceRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";
import * as controller from "./chat.controller";

export const chatRouter: Router = Router();
chatRouter.use(authenticate);

chatRouter.get("/workspaces/:workspaceId/channels", requireWorkspaceRole("GUEST"), asyncHandler(controller.listChannels));
chatRouter.post(
  "/workspaces/:workspaceId/channels",
  requireWorkspaceRole("MEMBER"),
  validateBody(createChannelSchema),
  asyncHandler(controller.createChannel),
);
chatRouter.post("/workspaces/:workspaceId/dm/:userId", requireWorkspaceRole("MEMBER"), asyncHandler(controller.getOrCreateDm));

chatRouter.get("/channels/:id/messages", asyncHandler(controller.listMessages));
chatRouter.post("/channels/:id/messages", validateBody(createMessageSchema), asyncHandler(controller.createMessage));
chatRouter.patch("/messages/:id", asyncHandler(controller.editMessage));
chatRouter.delete("/messages/:id", asyncHandler(controller.deleteMessage));
chatRouter.post("/messages/:id/reactions", validateBody(addReactionSchema), asyncHandler(controller.addReaction));
chatRouter.delete("/messages/:id/reactions/:emoji", asyncHandler(controller.removeReaction));
