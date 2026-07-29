import { Router, type RequestHandler } from "express";
import passport from "passport";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@repo/shared-types";
import { validateBody } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { asyncHandler } from "../../lib/asyncHandler";
import { isGoogleOAuthConfigured, env } from "../../config/env";
import * as authController from "./auth.controller";
import { issueTokenPair, publicUser } from "./auth.service";

export const authRouter: Router = Router();

authRouter.post("/register", validateBody(registerSchema), asyncHandler(authController.register));
authRouter.post("/login", validateBody(loginSchema), asyncHandler(authController.login));
authRouter.post("/refresh", asyncHandler(authController.refresh));
authRouter.post("/logout", asyncHandler(authController.logout));
authRouter.get("/verify-email/:token", asyncHandler(authController.verifyEmail));
authRouter.post("/resend-verification", authenticate, asyncHandler(authController.resendVerification));
authRouter.post("/forgot-password", validateBody(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
authRouter.post("/reset-password", validateBody(resetPasswordSchema), asyncHandler(authController.resetPassword));
authRouter.get("/me", authenticate, asyncHandler(authController.me));

if (isGoogleOAuthConfigured) {
  authRouter.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
  authRouter.get(
    "/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: `${env.webOrigin}/login?error=google` }),
    asyncHandler(async (req, res) => {
      const user = req.user as { id: string; email: string };
      const tokens = await issueTokenPair(user.id, user.email);
      res.cookie("refreshToken", tokens.refreshToken, {
        httpOnly: true,
        secure: env.nodeEnv === "production",
        sameSite: "lax",
        maxAge: env.jwtRefreshExpiresInMs,
        path: "/api/auth",
      });
      res.redirect(`${env.webOrigin}/auth/callback#accessToken=${tokens.accessToken}`);
    }),
  );
} else {
  // Both are reached by a browser navigation from the sign-in button, so send
  // the person to a page that can explain itself rather than raw JSON.
  const notConfigured: RequestHandler = (_req, res) => {
    res.redirect(`${env.webOrigin}/login?error=google-unavailable`);
  };
  authRouter.get("/google", notConfigured);
  authRouter.get("/google/callback", notConfigured);
}
