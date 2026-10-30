import cors from "cors";
import express from "express";
import {
  ConsoleStubApprovalChannel,
  InMemoryApprovalChannel,
} from "./approval/stub-channel.js";
import { ApprovalTicketStore } from "./approval/tickets.js";
import { authStub } from "./auth/middleware.js";
import { config } from "./config.js";
import { CursorCloudAgentsClient } from "./cursor/client.js";
import { Orchestrator } from "./orchestrator.js";
import { approvalsRouter } from "./routes/approvals.js";
import { commandsRouter } from "./routes/commands.js";
import { healthRouter } from "./routes/health.js";

export function createApp() {
  const channel =
    config.approvalChannel === "in_memory"
      ? new InMemoryApprovalChannel()
      : new ConsoleStubApprovalChannel();
  const tickets = new ApprovalTicketStore(channel);
  const cursor = new CursorCloudAgentsClient();
  const orch = new Orchestrator(cursor, tickets);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(healthRouter);
  app.use(authStub);
  app.use(commandsRouter(orch, cursor));
  app.use(approvalsRouter(tickets, orch));

  app.get("/v1/session", (req, res) => {
    res.json({
      session: req.session,
      note: "Slice 1 auth stub. Sign in with Apple plan: src/auth/README.md",
    });
  });

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[jarvis]", message);
      res.status(500).json({ error: "internal_error", message });
    },
  );

  return { app, orch, tickets, cursor };
}
