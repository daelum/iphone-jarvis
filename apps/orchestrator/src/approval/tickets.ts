import { randomUUID } from "node:crypto";
import { vault } from "../vault/ephemeral.js";
import type { ApprovalChannel, ApprovalKind, ApprovalTicket } from "./types.js";

const DEFAULT_TTL_MS = 15 * 60 * 1000;

export class ApprovalTicketStore {
  private readonly tickets = new Map<string, ApprovalTicket>();

  constructor(private readonly channel: ApprovalChannel) {}

  async create(input: {
    kind: ApprovalKind;
    reason: string;
    secretName?: string;
    agentId?: string;
    correlationId?: string;
    ttlMs?: number;
  }): Promise<ApprovalTicket> {
    const now = Date.now();
    const ticket: ApprovalTicket = {
      id: `tkt_${randomUUID()}`,
      kind: input.kind,
      status: "pending",
      reason: input.reason,
      secretName: input.secretName,
      agentId: input.agentId,
      correlationId: input.correlationId ?? randomUUID(),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + (input.ttlMs ?? DEFAULT_TTL_MS)).toISOString(),
    };
    this.tickets.set(ticket.id, ticket);
    await this.channel.notify(ticket);
    return ticket;
  }

  get(id: string): ApprovalTicket | undefined {
    return this.tickets.get(id);
  }

  listPending(agentId?: string): ApprovalTicket[] {
    this.expireStale();
    return [...this.tickets.values()].filter(
      (t) =>
        t.status === "pending" &&
        (!agentId || t.agentId === agentId),
    );
  }

  listAll(): ApprovalTicket[] {
    this.expireStale();
    return [...this.tickets.values()].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    );
  }

  async approve(id: string): Promise<ApprovalTicket> {
    const ticket = this.requirePending(id);
    if (ticket.kind === "request_secret") {
      throw new Error(
        "Secret tickets need fulfillSecret(), not approve(). Provide the secret value via the stub channel.",
      );
    }
    ticket.status = "approved";
    ticket.resolvedAt = new Date().toISOString();
    await this.channel.onResolved?.(ticket);
    return ticket;
  }

  async deny(id: string): Promise<ApprovalTicket> {
    const ticket = this.requirePending(id);
    ticket.status = "denied";
    ticket.resolvedAt = new Date().toISOString();
    if (ticket.sealedSecretId) {
      vault.destroy(ticket.sealedSecretId);
    }
    await this.channel.onResolved?.(ticket);
    return ticket;
  }

  /**
   * Stub / WhatsApp path for secret replies: seal into vault, mark fulfilled.
   * Never write the plaintext onto the ticket or into Cursor prompts.
   */
  async fulfillSecret(
    id: string,
    value: string,
  ): Promise<{ ticket: ApprovalTicket; sealedSecretId: string }> {
    const ticket = this.requirePending(id);
    if (ticket.kind !== "request_secret") {
      throw new Error("Only request_secret tickets accept secret fulfillment.");
    }
    if (!ticket.secretName) {
      throw new Error("Ticket is missing secretName.");
    }
    const sealed = vault.put({
      ticketId: ticket.id,
      name: ticket.secretName,
      value,
    });
    ticket.sealedSecretId = sealed.id;
    ticket.status = "fulfilled";
    ticket.resolvedAt = new Date().toISOString();
    await this.channel.onResolved?.(ticket);
    return { ticket, sealedSecretId: sealed.id };
  }

  /**
   * Drain vault secrets for a ticket into envVars for Cursor injection.
   * Consumes single-use vault entries.
   */
  consumeSecretsForEnv(ticketId: string): Record<string, string> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket?.sealedSecretId) return {};
    const consumed = vault.consume(ticket.sealedSecretId);
    if (!consumed) return {};
    return { [consumed.name]: consumed.value };
  }

  private requirePending(id: string): ApprovalTicket {
    this.expireStale();
    const ticket = this.tickets.get(id);
    if (!ticket) throw new Error(`Unknown ticket: ${id}`);
    if (ticket.status !== "pending") {
      throw new Error(`Ticket ${id} is ${ticket.status}, not pending`);
    }
    return ticket;
  }

  private expireStale(): void {
    const now = Date.now();
    for (const ticket of this.tickets.values()) {
      if (
        ticket.status === "pending" &&
        new Date(ticket.expiresAt).getTime() <= now
      ) {
        ticket.status = "expired";
        ticket.resolvedAt = new Date().toISOString();
      }
    }
  }
}
