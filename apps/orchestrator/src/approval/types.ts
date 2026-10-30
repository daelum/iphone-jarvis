export type ApprovalKind = "confirm_action" | "request_secret";
export type ApprovalStatus =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "fulfilled";

export interface ApprovalTicket {
  id: string;
  kind: ApprovalKind;
  status: ApprovalStatus;
  /** Human-readable reason shown on phone + stub channel */
  reason: string;
  /** Optional env var name when kind === request_secret */
  secretName?: string;
  agentId?: string;
  correlationId: string;
  createdAt: string;
  expiresAt: string;
  resolvedAt?: string;
  /** Vault secret id once user supplied a value (stub channel) */
  sealedSecretId?: string;
}

/**
 * Port shared by the Slice 1 stub channel and the future WhatsApp worker.
 * Swap implementations without changing orchestrator ticket/vault contracts.
 */
export interface ApprovalChannel {
  readonly name: string;
  /** Notify the human channel that a ticket needs attention. */
  notify(ticket: ApprovalTicket): Promise<void>;
  /** Optional: channel-specific ack after resolve. */
  onResolved?(ticket: ApprovalTicket): Promise<void>;
}
