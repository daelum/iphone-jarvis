import { config } from "../config.js";
import {
  assertNoSecretsInPrompt,
  buildSafePromptText,
} from "../redaction/index.js";

export interface CursorAgent {
  id: string;
  name?: string;
  url?: string;
  latestRunId?: string;
  status?: string;
  [key: string]: unknown;
}

export interface CursorRun {
  id: string;
  status?: string;
  [key: string]: unknown;
}

export interface CreateAgentResult {
  agent: CursorAgent;
  run: CursorRun;
}

export interface CreateAgentInput {
  text: string;
  name?: string;
  repoUrl?: string;
  startingRef?: string;
  autoCreatePR?: boolean;
  envVars?: Record<string, string>;
  credentialsInjected?: boolean;
}

export interface FollowUpInput {
  agentId: string;
  text: string;
  envVars?: Record<string, string>;
  credentialsInjected?: boolean;
}

export interface SteerInput {
  agentId: string;
  text: string;
}

/**
 * Thin Cursor Cloud Agents API v1 adapter.
 * Auth: Basic (apiKey:) or Bearer — we use Basic per docs examples.
 */
export class CursorCloudAgentsClient {
  constructor(
    private readonly apiKey: string = config.cursorApiKey,
    private readonly baseUrl: string = config.cursorApiBaseUrl,
  ) {}

  private authHeader(): string {
    const token = Buffer.from(`${this.apiKey}:`).toString("base64");
    return `Basic ${token}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    init?: RequestInit,
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error("CURSOR_API_KEY is not configured");
    }
    const headers: Record<string, string> = {
      Authorization: this.authHeader(),
      Accept: (init?.headers as Record<string, string> | undefined)?.Accept ??
        "application/json",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new CursorApiError(res.status, errText || res.statusText);
    }
    if (res.status === 204) {
      return undefined as T;
    }
    return (await res.json()) as T;
  }

  async createAgent(input: CreateAgentInput): Promise<CreateAgentResult> {
    const promptText = buildSafePromptText(input.text, {
      credentialsInjected: input.credentialsInjected || Boolean(input.envVars),
    });
    assertNoSecretsInPrompt(promptText);

    const body: Record<string, unknown> = {
      prompt: { text: promptText },
    };
    if (input.name) body.name = input.name;
    if (input.autoCreatePR !== undefined) body.autoCreatePR = input.autoCreatePR;
    if (input.envVars && Object.keys(input.envVars).length > 0) {
      // Cannot combine client-supplied agentId with envVars — omit agentId.
      body.envVars = input.envVars;
    }
    const repoUrl = input.repoUrl ?? config.defaultRepoUrl;
    if (repoUrl) {
      body.repos = [
        {
          url: repoUrl,
          startingRef: input.startingRef ?? config.defaultRepoRef,
        },
      ];
    }

    const data = await this.request<{
      agent?: CursorAgent;
      run?: CursorRun;
      id?: string;
    }>("POST", "/v1/agents", body);

    // Response may nest agent/run or return a flatter shape — normalize.
    const agent = data.agent ?? (data as unknown as CursorAgent);
    const run =
      data.run ??
      ({
        id: agent.latestRunId ?? "",
        status: agent.status ?? "CREATING",
      } as CursorRun);

    if (!agent.url && agent.id) {
      agent.url = `https://cursor.com/agents/${agent.id}`;
    }
    return { agent, run };
  }

  async listAgents(limit = 20): Promise<{ agents: CursorAgent[] }> {
    return this.request("GET", `/v1/agents?limit=${limit}`);
  }

  async getAgent(id: string): Promise<CursorAgent> {
    const agent = await this.request<CursorAgent>("GET", `/v1/agents/${id}`);
    if (!agent.url && agent.id) {
      agent.url = `https://cursor.com/agents/${agent.id}`;
    }
    return agent;
  }

  async createRun(input: FollowUpInput): Promise<CursorRun> {
    const promptText = buildSafePromptText(input.text, {
      credentialsInjected: input.credentialsInjected || Boolean(input.envVars),
    });
    assertNoSecretsInPrompt(promptText);

    const body: Record<string, unknown> = {
      prompt: { text: promptText },
    };
    if (input.envVars && Object.keys(input.envVars).length > 0) {
      body.envVars = input.envVars;
    }
    return this.request("POST", `/v1/agents/${input.agentId}/runs`, body);
  }

  async steer(input: SteerInput): Promise<CursorRun & { delivery?: string }> {
    const promptText = buildSafePromptText(input.text);
    assertNoSecretsInPrompt(promptText);
    return this.request("POST", `/v1/agents/${input.agentId}/runs`, {
      prompt: { text: promptText },
      delivery: "steer",
    });
  }

  async getRun(agentId: string, runId: string): Promise<CursorRun> {
    return this.request("GET", `/v1/agents/${agentId}/runs/${runId}`);
  }

  async listRuns(
    agentId: string,
    limit = 20,
  ): Promise<{ runs: CursorRun[] }> {
    return this.request("GET", `/v1/agents/${agentId}/runs?limit=${limit}`);
  }

  async cancelRun(agentId: string, runId: string): Promise<{ id: string }> {
    return this.request(
      "POST",
      `/v1/agents/${agentId}/runs/${runId}/cancel`,
    );
  }

  /**
   * Open an SSE stream to Cursor and return the upstream Response for proxying.
   */
  async openRunStream(agentId: string, runId: string): Promise<Response> {
    if (!this.apiKey) {
      throw new Error("CURSOR_API_KEY is not configured");
    }
    const res = await fetch(
      `${this.baseUrl}/v1/agents/${agentId}/runs/${runId}/stream`,
      {
        method: "GET",
        headers: {
          Authorization: this.authHeader(),
          Accept: "text/event-stream",
        },
      },
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new CursorApiError(res.status, errText || res.statusText);
    }
    return res;
  }
}

export class CursorApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Cursor API ${status}: ${body}`);
    this.name = "CursorApiError";
  }
}

export const cursorClient = new CursorCloudAgentsClient();
