import { randomUUID } from "node:crypto";
import type { ApprovalTicketStore } from "./approval/tickets.js";
import { config } from "./config.js";
import {
  CursorApiError,
  type CursorCloudAgentsClient,
} from "./cursor/client.js";
import type {
  ConversationMessage,
  CreateAgentRequest,
  FollowUpRequest,
  LiveStatus,
  RunStatus,
  SteerRequest,
} from "./types/api.js";

function normalizeStatus(raw?: string): RunStatus {
  const known: RunStatus[] = [
    "CREATING",
    "RUNNING",
    "WAITING_FOR_BACKGROUND_WORK",
    "FINISHED",
    "FAILED",
    "CANCELLED",
    "EXPIRED",
  ];
  if (raw && (known as string[]).includes(raw)) return raw as RunStatus;
  return "UNKNOWN";
}

/**
 * Orchestrator maps mobile intents → Cloud Agents + approval/vault.
 */
export class Orchestrator {
  private readonly messages: ConversationMessage[] = [];
  /** Last known agent focus for overlay status */
  private focusedAgentId?: string;
  private focusedRunId?: string;

  constructor(
    private readonly cursor: CursorCloudAgentsClient,
    private readonly tickets: ApprovalTicketStore,
  ) {}

  listMessages(): ConversationMessage[] {
    return [...this.messages];
  }

  private pushMessage(
    partial: Omit<ConversationMessage, "id" | "createdAt">,
  ): ConversationMessage {
    const msg: ConversationMessage = {
      ...partial,
      id: `msg_${randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    this.messages.unshift(msg);
    if (this.messages.length > 200) this.messages.length = 200;
    return msg;
  }

  async createAgent(req: CreateAgentRequest): Promise<{
    agentId: string;
    runId?: string;
    url?: string;
    name?: string;
    status: RunStatus;
    pendingTicket?: { id: string; reason: string };
    mock?: boolean;
  }> {
    this.pushMessage({ role: "user", text: req.text });

    if (req.requireApproval) {
      const ticket = await this.tickets.create({
        kind: "confirm_action",
        reason: `Approve creating a Cloud Agent for: ${req.text.slice(0, 120)}`,
      });
      this.pushMessage({
        role: "system",
        text: `Pending approval ${ticket.id} (stub channel). Approve to continue.`,
      });
      return {
        agentId: "",
        status: "UNKNOWN",
        pendingTicket: { id: ticket.id, reason: ticket.reason },
      };
    }

    if (!config.hasCursorApiKey()) {
      return this.mockCreate(req);
    }

    let envVars = { ...(req.envVars ?? {}) };
    // Drain any fulfilled secret tickets into envVars (never into prompt)
    for (const ticket of this.tickets.listAll()) {
      if (ticket.status === "fulfilled" && ticket.sealedSecretId) {
        Object.assign(envVars, this.tickets.consumeSecretsForEnv(ticket.id));
      }
    }
    const credentialsInjected = Object.keys(envVars).length > 0;

    try {
      const { agent, run } = await this.cursor.createAgent({
        text: req.text,
        name: req.name,
        repoUrl: req.repoUrl,
        startingRef: req.startingRef,
        autoCreatePR: req.autoCreatePR,
        envVars: credentialsInjected ? envVars : undefined,
        credentialsInjected,
      });
      this.focusedAgentId = agent.id;
      this.focusedRunId = run.id || agent.latestRunId;
      this.pushMessage({
        role: "assistant",
        text: `Agent ${agent.name ?? agent.id} started (${normalizeStatus(String(run.status ?? "CREATING"))}).`,
        agentId: agent.id,
        runId: this.focusedRunId,
      });
      return {
        agentId: agent.id,
        runId: this.focusedRunId,
        url: agent.url ?? `https://cursor.com/agents/${agent.id}`,
        name: agent.name,
        status: normalizeStatus(String(run.status ?? "CREATING")),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.pushMessage({ role: "system", text: `Create failed: ${message}` });
      throw err;
    }
  }

  /** Offline-friendly skeleton when CURSOR_API_KEY is absent. */
  private mockCreate(req: CreateAgentRequest) {
    const agentId = `bc-mock-${randomUUID()}`;
    const runId = `run-mock-${randomUUID()}`;
    this.focusedAgentId = agentId;
    this.focusedRunId = runId;
    const url = `https://cursor.com/agents/${agentId}`;
    this.pushMessage({
      role: "assistant",
      text: `Mock agent created (no CURSOR_API_KEY). Open ${url} after configuring a real key.`,
      agentId,
      runId,
    });
    return {
      agentId,
      runId,
      url,
      name: req.name ?? "Mock agent",
      status: "CREATING" as RunStatus,
      mock: true,
    };
  }

  async followUp(
    agentId: string,
    req: FollowUpRequest,
  ): Promise<{ runId?: string; status: RunStatus; mock?: boolean }> {
    this.pushMessage({ role: "user", text: req.text, agentId });
    this.focusedAgentId = agentId;

    if (!config.hasCursorApiKey() || agentId.startsWith("bc-mock-")) {
      const runId = `run-mock-${randomUUID()}`;
      this.focusedRunId = runId;
      this.pushMessage({
        role: "assistant",
        text: "Mock follow-up accepted (no live Cursor key).",
        agentId,
        runId,
      });
      return { runId, status: "RUNNING", mock: true };
    }

    const envVars = { ...(req.envVars ?? {}) };
    const credentialsInjected = Object.keys(envVars).length > 0;
    const run = await this.cursor.createRun({
      agentId,
      text: req.text,
      envVars: credentialsInjected ? envVars : undefined,
      credentialsInjected,
    });
    this.focusedRunId = run.id;
    this.pushMessage({
      role: "assistant",
      text: `Follow-up run ${run.id} (${normalizeStatus(String(run.status ?? "RUNNING"))}).`,
      agentId,
      runId: run.id,
    });
    return {
      runId: run.id,
      status: normalizeStatus(String(run.status ?? "RUNNING")),
    };
  }

  async steer(
    agentId: string,
    req: SteerRequest,
  ): Promise<{
    runId?: string;
    delivery?: string;
    status: RunStatus;
    mock?: boolean;
  }> {
    this.pushMessage({ role: "user", text: `[steer] ${req.text}`, agentId });
    this.focusedAgentId = agentId;

    if (!config.hasCursorApiKey() || agentId.startsWith("bc-mock-")) {
      this.pushMessage({
        role: "assistant",
        text: "Mock steer accepted.",
        agentId,
      });
      return { status: "RUNNING", delivery: "steered", mock: true };
    }

    try {
      const run = await this.cursor.steer({ agentId, text: req.text });
      if (run.id) this.focusedRunId = run.id;
      this.pushMessage({
        role: "assistant",
        text: `Steer ${run.delivery ?? "ok"}${run.id ? ` → ${run.id}` : ""}.`,
        agentId,
        runId: run.id,
      });
      return {
        runId: run.id,
        delivery: run.delivery,
        status: normalizeStatus(String(run.status ?? "RUNNING")),
      };
    } catch (err) {
      if (err instanceof CursorApiError && err.status === 403) {
        // feature_unavailable — fall back to ordinary follow-up
        this.pushMessage({
          role: "system",
          text: "Steer unavailable on this account; falling back to follow-up.",
        });
        return this.followUp(agentId, { text: req.text });
      }
      throw err;
    }
  }

  async cancel(
    agentId: string,
    runId: string,
  ): Promise<{ id: string; mock?: boolean }> {
    this.focusedAgentId = agentId;
    this.focusedRunId = runId;

    if (!config.hasCursorApiKey() || agentId.startsWith("bc-mock-")) {
      this.pushMessage({
        role: "system",
        text: `Mock cancel of ${runId}.`,
        agentId,
        runId,
      });
      return { id: runId, mock: true };
    }

    const result = await this.cursor.cancelRun(agentId, runId);
    this.pushMessage({
      role: "system",
      text: `Cancelled run ${result.id}.`,
      agentId,
      runId: result.id,
    });
    return result;
  }

  async liveStatus(agentId?: string): Promise<LiveStatus> {
    const id = agentId ?? this.focusedAgentId;
    const pending = this.tickets.listPending(id).length;

    if (!id) {
      return {
        agentId: "",
        status: "UNKNOWN",
        pendingApprovals: this.tickets.listPending().length,
        summary: "No active agent",
      };
    }

    if (!config.hasCursorApiKey() || id.startsWith("bc-mock-")) {
      return {
        agentId: id,
        runId: this.focusedRunId,
        status: "RUNNING",
        name: "Mock agent",
        url: `https://cursor.com/agents/${id}`,
        pendingApprovals: pending,
        summary: "Mock status (set CURSOR_API_KEY for live data)",
      };
    }

    const agent = await this.cursor.getAgent(id);
    let status: RunStatus = "UNKNOWN";
    let runId = this.focusedRunId ?? agent.latestRunId;
    if (runId) {
      try {
        const run = await this.cursor.getRun(id, runId);
        status = normalizeStatus(String(run.status ?? "UNKNOWN"));
        this.focusedRunId = run.id ?? runId;
      } catch {
        status = normalizeStatus(String(agent.status ?? "UNKNOWN"));
      }
    }

    return {
      agentId: id,
      runId,
      status,
      name: agent.name,
      url: agent.url ?? `https://cursor.com/agents/${id}`,
      pendingApprovals: pending,
    };
  }

  async listAgents() {
    if (!config.hasCursorApiKey()) {
      return {
        agents: this.focusedAgentId
          ? [
              {
                id: this.focusedAgentId,
                name: "Mock agent",
                url: `https://cursor.com/agents/${this.focusedAgentId}`,
                mock: true,
              },
            ]
          : [],
        mock: true,
      };
    }
    return this.cursor.listAgents();
  }

  /** Demo: open a secret-request ticket via the stub channel. */
  async requestSecret(input: {
    reason: string;
    secretName: string;
    agentId?: string;
  }) {
    return this.tickets.create({
      kind: "request_secret",
      reason: input.reason,
      secretName: input.secretName,
      agentId: input.agentId ?? this.focusedAgentId,
    });
  }
}
