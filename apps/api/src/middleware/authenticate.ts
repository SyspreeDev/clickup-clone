import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { UnauthorizedError } from "../lib/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // Augments passport's empty Express.User (not replacing Request.user,
    // which express + passport already declare as `user?: User`).
    interface User {
      id: string;
      email: string;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing access token");
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.userId, email: payload.email };
    next();
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}
