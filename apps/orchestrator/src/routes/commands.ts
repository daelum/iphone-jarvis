import { Router } from "express";
import { z } from "zod";
import { CursorApiError } from "../cursor/client.js";
import type { Orchestrator } from "../orchestrator.js";
import type { CursorCloudAgentsClient } from "../cursor/client.js";

const createSchema = z.object({
  text: z.string().min(1),
  name: z.string().max(100).optional(),
  repoUrl: z.string().url().optional(),
  startingRef: z.string().optional(),
  autoCreatePR: z.boolean().optional(),
  envVars: z.record(z.string().min(1).max(4096)).optional(),
  requireApproval: z.boolean().optional(),
});

const textSchema = z.object({
  text: z.string().min(1),
  envVars: z.record(z.string().min(1).max(4096)).optional(),
});

const steerSchema = z.object({
  text: z.string().min(1),
});

function handleError(res: import("express").Response, err: unknown): void {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: "validation_error", details: err.flatten() });
    return;
  }
  if (err instanceof CursorApiError) {
    res.status(err.status).json({ error: "cursor_api_error", body: err.body });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).json({ error: "internal_error", message });
}

export function commandsRouter(
  orch: Orchestrator,
  cursor: CursorCloudAgentsClient,
): Router {
  const router = Router();

  router.get("/v1/messages", (_req, res) => {
    res.json({ messages: orch.listMessages() });
  });

  router.get("/v1/agents", async (_req, res) => {
    try {
      const data = await orch.listAgents();
      res.json(data);
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/v1/agents", async (req, res) => {
    try {
      const body = createSchema.parse(req.body);
      const result = await orch.createAgent(body);
      res.status(result.pendingTicket ? 202 : 201).json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get("/v1/agents/:agentId", async (req, res) => {
    try {
      const agent = await cursor.getAgent(req.params.agentId);
      res.json(agent);
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/v1/agents/:agentId/follow-up", async (req, res) => {
    try {
      const body = textSchema.parse(req.body);
      const result = await orch.followUp(req.params.agentId, body);
      res.status(202).json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/v1/agents/:agentId/steer", async (req, res) => {
    try {
      const body = steerSchema.parse(req.body);
      const result = await orch.steer(req.params.agentId, body);
      res.status(202).json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/v1/agents/:agentId/runs/:runId/cancel", async (req, res) => {
    try {
      const result = await orch.cancel(req.params.agentId, req.params.runId);
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get("/v1/status", async (req, res) => {
    try {
      const agentId =
        typeof req.query.agentId === "string" ? req.query.agentId : undefined;
      const status = await orch.liveStatus(agentId);
      res.json(status);
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get("/v1/agents/:agentId/status", async (req, res) => {
    try {
      const status = await orch.liveStatus(req.params.agentId);
      res.json(status);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * SSE proxy for a Cursor run stream.
   * Clients: EventSource or URLSession with text/event-stream.
   */
  router.get(
    "/v1/agents/:agentId/runs/:runId/stream",
    async (req, res) => {
      try {
        const upstream = await cursor.openRunStream(
          req.params.agentId,
          req.params.runId,
        );
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();

        if (!upstream.body) {
          res.write(`event: error\ndata: ${JSON.stringify({ message: "empty upstream body" })}\n\n`);
          res.end();
          return;
        }

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value, { stream: true }));
          }
          res.end();
        };
        req.on("close", () => {
          reader.cancel().catch(() => undefined);
        });
        await pump();
      } catch (err) {
        if (err instanceof CursorApiError) {
          res.status(err.status).json({ error: "cursor_api_error", body: err.body });
          return;
        }
        // Mock stream when no key / mock agent
        if (req.params.agentId.startsWith("bc-mock-")) {
          res.setHeader("Content-Type", "text/event-stream");
          res.write(
            `event: status\ndata: ${JSON.stringify({ runId: req.params.runId, status: "RUNNING" })}\n\n`,
          );
          res.write(
            `event: assistant\ndata: ${JSON.stringify({ text: "Mock stream — set CURSOR_API_KEY for live SSE." })}\n\n`,
          );
          res.write(`event: done\ndata: {}\n\n`);
          res.end();
          return;
        }
        handleError(res, err);
      }
    },
  );

  return router;
}
