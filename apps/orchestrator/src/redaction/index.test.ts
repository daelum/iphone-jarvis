import { describe, expect, it } from "vitest";
import {
  assertNoSecretsInPrompt,
  buildSafePromptText,
  containsSecretLike,
  redactText,
} from "./index.js";

describe("redaction", () => {
  it("redacts password assignments", () => {
    const input = 'deploy with password: hunter2 and continue';
    expect(redactText(input)).not.toContain("hunter2");
    expect(redactText(input)).toContain("[REDACTED]");
  });

  it("redacts bearer tokens and github pats", () => {
    expect(redactText("Authorization Bearer abcdefghijklmnop")).toContain(
      "[REDACTED]",
    );
    expect(redactText("use ghp_abcdefghijklmnopqrstuvwxyz123456")).toContain(
      "[REDACTED]",
    );
  });

  it("buildSafePromptText never leaves raw password substrings", () => {
    const prompt = buildSafePromptText("login with password=SuperSecret123", {
      credentialsInjected: true,
    });
    expect(prompt).not.toMatch(/SuperSecret123/);
    expect(prompt).toContain("out-of-band");
    expect(() => assertNoSecretsInPrompt(prompt)).not.toThrow();
  });

  it("assertNoSecretsInPrompt fails closed on leaked secrets", () => {
    expect(() =>
      assertNoSecretsInPrompt("password: should-not-ship"),
    ).toThrow(/envVars/);
  });

  it("detects secret-like content", () => {
    expect(containsSecretLike("api_key=abc123xyz")).toBe(true);
    expect(containsSecretLike("refactor the login button")).toBe(false);
  });
});
