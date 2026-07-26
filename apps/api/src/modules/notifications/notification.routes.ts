import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { asyncHandler } from "../../lib/asyncHandler";
import * as service from "./notification.service";

export const notificationRouter: Router = Router();
notificationRouter.use(authenticate);

notificationRouter.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    res.json(await service.listNotifications(req.user!.id, req.query.unread === "true"));
  }),
);
notificationRouter.patch(
  "/notifications/read-all",
  asyncHandler(async (req, res) => {
    await service.markAllRead(req.user!.id);
    res.status(204).send();
  }),
);
notificationRouter.patch(
  "/notifications/:id/read",
  asyncHandler(async (req, res) => {
    await service.markRead(req.user!.id, req.params.id);
    res.status(204).send();
  }),
);
notificationRouter.delete(
  "/notifications/:id",
  asyncHandler(async (req, res) => {
    await service.remove(req.user!.id, req.params.id);
    res.status(204).send();
  }),
);
