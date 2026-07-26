import { Router } from "express";
import { changePasswordSchema } from "@repo/shared-types";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";
import * as userService from "./user.service";

export const userRouter: Router = Router();
userRouter.use(authenticate);

userRouter.patch(
  "/users/me",
  asyncHandler(async (req, res) => res.json(await userService.updateProfile(req.user!.id, req.body))),
);
userRouter.patch(
  "/users/me/password",
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    await userService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    res.json({ ok: true });
  }),
);

userRouter.get(
  "/users/me/api-tokens",
  asyncHandler(async (req, res) => res.json(await userService.listApiTokens(req.user!.id))),
);
userRouter.post(
  "/users/me/api-tokens",
  asyncHandler(async (req, res) => res.status(201).json(await userService.createApiToken(req.user!.id, req.body.name))),
);
userRouter.delete(
  "/users/me/api-tokens/:id",
  asyncHandler(async (req, res) => {
    await userService.revokeApiToken(req.user!.id, req.params.id);
    res.status(204).send();
  }),
);
