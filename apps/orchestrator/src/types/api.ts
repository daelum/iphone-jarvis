export type RunStatus =
  | "CREATING"
  | "RUNNING"
  | "WAITING_FOR_BACKGROUND_WORK"
  | "FINISHED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "UNKNOWN";

export interface CreateAgentRequest {
  text: string;
  name?: string;
  repoUrl?: string;
  startingRef?: string;
  autoCreatePR?: boolean;
  /** Dummy/test secrets only — injected via envVars, never into prompt.text */
  envVars?: Record<string, string>;
  /** Force an approval ticket before create (dev / policy demo) */
  requireApproval?: boolean;
}

export interface FollowUpRequest {
  text: string;
  envVars?: Record<string, string>;
}

export interface SteerRequest {
  text: string;
}

export interface LiveStatus {
  agentId: string;
  runId?: string;
  status: RunStatus;
  name?: string;
  url?: string;
  summary?: string;
  pendingApprovals: number;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
  agentId?: string;
  runId?: string;
}
