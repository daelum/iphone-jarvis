import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

export interface JarvisSession {
  /** Placeholder device / user id until Sign in with Apple lands */
  userId: string;
  deviceId: string;
  authMode: "dev-stub";
}

declare global {
  namespace Express {
    interface Request {
      session?: JarvisSession;
    }
  }
}

/**
 * Auth stub for Slice 1.
 *
 * Accepts `Authorization: Bearer <token>` where token equals JARVIS_DEV_TOKEN
 * (default `dev-token`), or a device-session header pair for local prototyping:
 *   X-Jarvis-Device-Id / X-Jarvis-User-Id
 *
 * Real Sign in with Apple will replace this — see ./README.md.
 */
export function authStub(req: Request, res: Response, next: NextFunction): void {
  if (req.path === "/health" || req.path === "/v1/health") {
    next();
    return;
  }

  const header = req.header("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token && token === config.jarvisDevToken) {
      req.session = {
        userId: "dev-user",
        deviceId: req.header("x-jarvis-device-id") ?? "dev-device",
        authMode: "dev-stub",
      };
      next();
      return;
    }
  }

  const deviceId = req.header("x-jarvis-device-id");
  const userId = req.header("x-jarvis-user-id");
  if (deviceId && userId) {
    req.session = { userId, deviceId, authMode: "dev-stub" };
    next();
    return;
  }

  res.status(401).json({
    error: "unauthorized",
    message:
      "Provide Authorization: Bearer <JARVIS_DEV_TOKEN> or X-Jarvis-Device-Id + X-Jarvis-User-Id. See apps/orchestrator/src/auth/README.md for Sign in with Apple plan.",
  });
}
