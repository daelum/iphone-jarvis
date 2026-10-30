export const config = {
  port: Number(process.env.PORT ?? 8787),
  cursorApiKey: process.env.CURSOR_API_KEY ?? "",
  cursorApiBaseUrl: (
    process.env.CURSOR_API_BASE_URL ?? "https://api.cursor.com"
  ).replace(/\/$/, ""),
  defaultRepoUrl:
    process.env.DEFAULT_REPO_URL ?? "https://github.com/daelum/iphone-jarvis",
  defaultRepoRef: process.env.DEFAULT_REPO_REF ?? "main",
  jarvisDevToken: process.env.JARVIS_DEV_TOKEN ?? "dev-token",
  approvalChannel: (process.env.APPROVAL_CHANNEL ?? "console") as
    | "console"
    | "in_memory",
  vaultTtlSeconds: Number(process.env.VAULT_TTL_SECONDS ?? 600),
  hasCursorApiKey(): boolean {
    return Boolean(this.cursorApiKey.trim());
  },
  requireCursorApiKey(): string {
    if (!this.hasCursorApiKey()) {
      throw new Error(
        "CURSOR_API_KEY is not set. Live Cloud Agents calls need a key from Cursor Dashboard → API Keys.",
      );
    }
    return this.cursorApiKey;
  },
};
