import { Router } from "express";
import { z } from "zod";
import type { ApprovalTicketStore } from "../approval/tickets.js";
import type { Orchestrator } from "../orchestrator.js";

export function approvalsRouter(
  tickets: ApprovalTicketStore,
  orch: Orchestrator,
): Router {
  const router = Router();

  router.get("/v1/approvals", (_req, res) => {
    res.json({ tickets: tickets.listAll() });
  });

  router.get("/v1/approvals/pending", (_req, res) => {
    res.json({ tickets: tickets.listPending() });
  });

  router.post("/v1/approvals/request-secret", async (req, res) => {
    try {
      const body = z
        .object({
          reason: z.string().min(1),
          secretName: z
            .string()
            .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
            .refine((n) => !n.startsWith("CURSOR_"), {
              message: "secretName cannot start with CURSOR_",
            }),
          agentId: z.string().optional(),
        })
        .parse(req.body);
      const ticket = await orch.requestSecret(body);
      res.status(201).json({ ticket });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: "bad_request", message });
    }
  });

  router.post("/v1/approvals/:id/approve", async (req, res) => {
    try {
      const ticket = await tickets.approve(req.params.id);
      res.json({ ticket });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: "bad_request", message });
    }
  });

  router.post("/v1/approvals/:id/deny", async (req, res) => {
    try {
      const ticket = await tickets.deny(req.params.id);
      res.json({ ticket });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: "bad_request", message });
    }
  });

  /**
   * Stub secret fulfillment — same contract WhatsApp reply will use.
   * Value is sealed into the vault; never echoed in the response body.
   */
  router.post("/v1/approvals/:id/secret", async (req, res) => {
    try {
      const body = z.object({ value: z.string().min(1).max(4096) }).parse(req.body);
      const { ticket, sealedSecretId } = await tickets.fulfillSecret(
        req.params.id,
        body.value,
      );
      res.json({
        ticket: {
          id: ticket.id,
          status: ticket.status,
          secretName: ticket.secretName,
          sealedSecretId,
        },
        message: "Secret received ✓ (value not logged; stored in ephemeral vault)",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: "bad_request", message });
    }
  });

  return router;
}
