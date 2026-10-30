import { describe, expect, it } from "vitest";
import { InMemoryApprovalChannel } from "./stub-channel.js";
import { ApprovalTicketStore } from "./tickets.js";
import { vault } from "../vault/ephemeral.js";

describe("ApprovalTicketStore + vault", () => {
  it("seals secrets without exposing plaintext on the ticket", async () => {
    const channel = new InMemoryApprovalChannel();
    const store = new ApprovalTicketStore(channel);

    const ticket = await store.create({
      kind: "request_secret",
      reason: "Need GitHub PAT",
      secretName: "GITHUB_TOKEN",
    });
    expect(channel.notified).toHaveLength(1);

    const { ticket: fulfilled, sealedSecretId } = await store.fulfillSecret(
      ticket.id,
      "ghp_thisIsOnlyATestTokenValue12",
    );
    expect(fulfilled.status).toBe("fulfilled");
    expect(JSON.stringify(fulfilled)).not.toContain("ghp_thisIsOnlyATestTokenValue12");

    const env = store.consumeSecretsForEnv(ticket.id);
    expect(env).toEqual({ GITHUB_TOKEN: "ghp_thisIsOnlyATestTokenValue12" });
    // single-use
    expect(store.consumeSecretsForEnv(ticket.id)).toEqual({});
    expect(vault.getMeta(sealedSecretId)).toBeUndefined();
  });

  it("approve/deny confirm_action tickets", async () => {
    const store = new ApprovalTicketStore(new InMemoryApprovalChannel());
    const ticket = await store.create({
      kind: "confirm_action",
      reason: "Force push?",
    });
    const approved = await store.approve(ticket.id);
    expect(approved.status).toBe("approved");

    const t2 = await store.create({
      kind: "confirm_action",
      reason: "Delete branch?",
    });
    const denied = await store.deny(t2.id);
    expect(denied.status).toBe("denied");
  });
});
