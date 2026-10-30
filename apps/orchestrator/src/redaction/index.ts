/**
 * Redaction layer — never forward secrets into Cursor prompt.text,
 * orchestrator logs, or mirrored phone transcripts.
 */

const SECRET_PATTERNS: RegExp[] = [
  // Explicit password / secret assignments
  /\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)\b\s*[:=]\s*["']?[^\s"']+/gi,
  // Bearer tokens
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  // GitHub PATs
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  // Common high-entropy key shapes
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
];

const PLACEHOLDER = "[REDACTED]";

export function redactText(input: string): string {
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, PLACEHOLDER);
  }
  return out;
}

/** True if any known secret-like substring appears in text. */
export function containsSecretLike(input: string): boolean {
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(input);
  });
}

/**
 * Build a Cursor prompt payload that is guaranteed free of vault secrets.
 * Secrets must travel via envVars (or MCP env), never prompt.text.
 */
export function buildSafePromptText(
  userText: string,
  options?: { credentialsInjected?: boolean },
): string {
  const redacted = redactText(userText.trim());
  if (options?.credentialsInjected) {
    return `${redacted}\n\n[credentials provided out-of-band via secure channel; do not expect passwords in this prompt]`;
  }
  return redacted;
}

export function assertNoSecretsInPrompt(promptText: string): void {
  if (containsSecretLike(promptText)) {
    throw new Error(
      "Refusing to send prompt.text that still looks like it contains secrets. Use envVars injection.",
    );
  }
}
