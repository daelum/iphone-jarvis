import { Router } from "express";
import { config } from "../config.js";

export const healthRouter = Router();

healthRouter.get(["/health", "/v1/health"], (_req, res) => {
  res.json({
    ok: true,
    service: "jarvis-orchestrator",
    slice: 1,
    cursorApiConfigured: config.hasCursorApiKey(),
    approvalChannel: config.approvalChannel,
    timestamp: new Date().toISOString(),
  });
});
