import type { Request, Response } from "express";
import { env } from "../../config/env";
import * as authService from "./auth.service";
import { UnauthorizedError } from "../../lib/errors";

const REFRESH_COOKIE = "refreshToken";

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    maxAge: env.jwtRefreshExpiresInMs,
    path: "/api/auth",
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
}

export async function register(req: Request, res: Response) {
  const result = await authService.register(req.body);
  setRefreshCookie(res, result.refreshToken);
  res.status(201).json({ user: result.user, accessToken: result.accessToken });
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body);
  setRefreshCookie(res, result.refreshToken);
  res.json({ user: result.user, accessToken: result.accessToken });
}

export async function publicSession(req: Request, res: Response) {
  const result = await authService.publicSession();
  setRefreshCookie(res, result.refreshToken);
  res.json({ user: result.user, accessToken: result.accessToken });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new UnauthorizedError("Missing refresh token");
  const result = await authService.refresh(token);
  setRefreshCookie(res, result.refreshToken);
  res.json({ user: result.user, accessToken: result.accessToken });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  res.status(204).send();
}

export async function verifyEmail(req: Request, res: Response) {
  await authService.verifyEmail(req.params.token);
  res.json({ ok: true });
}

export async function resendVerification(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  await authService.resendVerification(req.user.id);
  res.json({ ok: true });
}

export async function forgotPassword(req: Request, res: Response) {
  await authService.forgotPassword(req.body.email);
  res.json({ ok: true });
}

export async function resetPassword(req: Request, res: Response) {
  await authService.resetPassword(req.body);
  res.json({ ok: true });
}

export async function me(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError();
  const result = await authService.getMe(req.user.id);
  res.json(result);
}
