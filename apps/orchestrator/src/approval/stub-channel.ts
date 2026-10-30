import type { ApprovalChannel, ApprovalTicket } from "./types.js";

/**
 * Dev stub implementing the same ApprovalChannel port WhatsApp will use.
 * Logs to console (and is queryable via /v1/approvals). No Meta / Graph API.
 */
export class ConsoleStubApprovalChannel implements ApprovalChannel {
  readonly name = "console-stub";

  async notify(ticket: ApprovalTicket): Promise<void> {
    const lines = [
      "",
      "╔══════════════════════════════════════════════════════════╗",
      "║  Jarvis approval stub (WhatsApp channel not wired yet)   ║",
      "╠══════════════════════════════════════════════════════════╣",
      `║  ticket:  ${ticket.id}`,
      `║  kind:    ${ticket.kind}`,
      `║  reason:  ${ticket.reason}`,
      ticket.secretName ? `║  secret:  ${ticket.secretName}` : null,
      ticket.agentId ? `║  agent:   ${ticket.agentId}` : null,
      `║  expires: ${ticket.expiresAt}`,
      "║",
      "║  Resolve via:",
      `║    POST /v1/approvals/${ticket.id}/approve`,
      `║    POST /v1/approvals/${ticket.id}/deny`,
      ticket.kind === "request_secret"
        ? `║    POST /v1/approvals/${ticket.id}/secret  { "value": "..." }`
        : null,
      "╚══════════════════════════════════════════════════════════╝",
      "",
    ].filter(Boolean);
    console.info(lines.join("\n"));
  }

  async onResolved(ticket: ApprovalTicket): Promise<void> {
    console.info(
      `[approval-stub] ticket ${ticket.id} → ${ticket.status}` +
        (ticket.sealedSecretId
          ? ` (sealed ${ticket.sealedSecretId}; value not logged)`
          : ""),
    );
  }
}

/** Silent in-memory channel for tests. */
export class InMemoryApprovalChannel implements ApprovalChannel {
  readonly name = "in_memory";
  readonly notified: ApprovalTicket[] = [];

  async notify(ticket: ApprovalTicket): Promise<void> {
    this.notified.push(ticket);
  }
}
