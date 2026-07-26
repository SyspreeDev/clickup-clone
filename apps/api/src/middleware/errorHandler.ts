import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.path}` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
  }

  console.error(err);
  return res.status(500).json({ error: { message: "Internal server error" } });
}
