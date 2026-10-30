import { randomUUID } from "node:crypto";
import { config } from "../config.js";

export interface SealedSecret {
  id: string;
  ticketId: string;
  /** Logical key name for env injection (e.g. GITHUB_TOKEN) */
  name: string;
  createdAt: number;
  expiresAt: number;
  consumed: boolean;
}

interface VaultEntry extends SealedSecret {
  value: string;
}

/**
 * Ephemeral secrets vault — TTL + single-use.
 * Slice 1: in-memory. Later: Redis + KMS sealed envelopes.
 */
export interface EphemeralVault {
  put(input: {
    ticketId: string;
    name: string;
    value: string;
    ttlSeconds?: number;
  }): SealedSecret;
  /** Peek metadata without consuming. */
  getMeta(id: string): SealedSecret | undefined;
  /**
   * Consume once and return plaintext for envVars injection.
   * Returns undefined if missing, expired, or already consumed.
   */
  consume(id: string): { name: string; value: string } | undefined;
  /** Destroy without consuming (deny / expiry sweep). */
  destroy(id: string): void;
  listForTicket(ticketId: string): SealedSecret[];
}

export class InMemoryEphemeralVault implements EphemeralVault {
  private readonly entries = new Map<string, VaultEntry>();

  put(input: {
    ticketId: string;
    name: string;
    value: string;
    ttlSeconds?: number;
  }): SealedSecret {
    this.sweep();
    const now = Date.now();
    const ttlMs = (input.ttlSeconds ?? config.vaultTtlSeconds) * 1000;
    const id = `sec_${randomUUID()}`;
    const entry: VaultEntry = {
      id,
      ticketId: input.ticketId,
      name: input.name,
      value: input.value,
      createdAt: now,
      expiresAt: now + ttlMs,
      consumed: false,
    };
    this.entries.set(id, entry);
    return this.toMeta(entry);
  }

  getMeta(id: string): SealedSecret | undefined {
    this.sweep();
    const entry = this.entries.get(id);
    return entry ? this.toMeta(entry) : undefined;
  }

  consume(id: string): { name: string; value: string } | undefined {
    this.sweep();
    const entry = this.entries.get(id);
    if (!entry || entry.consumed || entry.expiresAt <= Date.now()) {
      return undefined;
    }
    entry.consumed = true;
    const payload = { name: entry.name, value: entry.value };
    // Destroy plaintext after handoff
    entry.value = "";
    this.entries.delete(id);
    return payload;
  }

  destroy(id: string): void {
    this.entries.delete(id);
  }

  listForTicket(ticketId: string): SealedSecret[] {
    this.sweep();
    return [...this.entries.values()]
      .filter((e) => e.ticketId === ticketId)
      .map((e) => this.toMeta(e));
  }

  private toMeta(entry: VaultEntry): SealedSecret {
    return {
      id: entry.id,
      ticketId: entry.ticketId,
      name: entry.name,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      consumed: entry.consumed,
    };
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt <= now || entry.consumed) {
        this.entries.delete(id);
      }
    }
  }
}

export const vault = new InMemoryEphemeralVault();
