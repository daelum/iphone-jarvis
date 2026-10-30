import { config } from "./config.js";
import { createApp } from "./server.js";

const { app } = createApp();

app.listen(config.port, () => {
  console.info(
    `[jarvis] orchestrator listening on http://localhost:${config.port}`,
  );
  console.info(
    `[jarvis] Cursor API key: ${config.hasCursorApiKey() ? "configured" : "MISSING (mock mode)"}`,
  );
  console.info(`[jarvis] approval channel: ${config.approvalChannel}`);
  console.info(
    `[jarvis] auth: Bearer ${config.jarvisDevToken} (stub — see src/auth/README.md)`,
  );
});
