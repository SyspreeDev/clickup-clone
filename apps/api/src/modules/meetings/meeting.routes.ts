import { Router } from "express";
import { createMeetingSchema, rsvpSchema } from "@repo/shared-types";
import { authenticate } from "../../middleware/authenticate";
import { requireWorkspaceRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";
import * as meetingService from "./meeting.service";

export const meetingRouter: Router = Router();
meetingRouter.use(authenticate);

meetingRouter.get(
  "/workspaces/:workspaceId/meetings",
  requireWorkspaceRole("GUEST"),
  asyncHandler(async (req, res) => {
    const scope = (req.query.scope as "upcoming" | "past" | "all") ?? "upcoming";
    res.json(await meetingService.listMeetings(req.params.workspaceId, scope));
  }),
);
meetingRouter.post(
  "/workspaces/:workspaceId/meetings",
  requireWorkspaceRole("MEMBER"),
  validateBody(createMeetingSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await meetingService.createMeeting(req.params.workspaceId, req.user!.id, req.body));
  }),
);

meetingRouter.get("/meetings/:id", asyncHandler(async (req, res) => res.json(await meetingService.getMeeting(req.params.id))));
meetingRouter.patch("/meetings/:id", asyncHandler(async (req, res) => res.json(await meetingService.updateMeeting(req.params.id, req.body))));
meetingRouter.delete(
  "/meetings/:id",
  asyncHandler(async (req, res) => {
    await meetingService.deleteMeeting(req.params.id);
    res.status(204).send();
  }),
);
meetingRouter.post(
  "/meetings/:id/rsvp",
  validateBody(rsvpSchema),
  asyncHandler(async (req, res) => res.json(await meetingService.rsvp(req.params.id, req.user!.id, req.body.status))),
);
