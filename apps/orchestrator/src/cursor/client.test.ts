import { describe, expect, it } from "vitest";
import {
  assertNoSecretsInPrompt,
  buildSafePromptText,
} from "../redaction/index.js";

/**
 * Integration-style guard: the adapter path that builds Cursor prompt payloads
 * must fail if a password substring would reach prompt.text.
 */
describe("Cursor adapter prompt hygiene", () => {
  it("strips secrets before prompt.text and allows envVars-only injection narrative", () => {
    const userSaid = "use the staging DB password=DontLeakMe99";
    const promptText = buildSafePromptText(userSaid, {
      credentialsInjected: true,
    });

    expect(promptText).not.toContain("DontLeakMe99");
    expect(() => assertNoSecretsInPrompt(promptText)).not.toThrow();

    // envVars carry the real value — this is the only allowed injection surface
    const envVars = { STAGING_DB_PASSWORD: "DontLeakMe99" };
    expect(envVars.STAGING_DB_PASSWORD).toBe("DontLeakMe99");
    expect(JSON.stringify({ prompt: { text: promptText } })).not.toContain(
      "DontLeakMe99",
    );
  });
});
