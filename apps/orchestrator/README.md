# Jarvis Orchestrator (Slice 1)

TypeScript / Node backend that the iPhone app talks to. Holds the Cursor API key, proxies Cloud Agents commands, and hosts the approval-ticket + ephemeral-vault contracts (WhatsApp worker swaps in later on the same port).

## Env vars

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `CURSOR_API_KEY` | for live agents | _(empty → mock mode)_ | Cursor Dashboard → API Keys (Basic auth to `api.cursor.com`) |
| `PORT` | no | `8787` | HTTP listen port |
| `CURSOR_API_BASE_URL` | no | `https://api.cursor.com` | Override for tests |
| `DEFAULT_REPO_URL` | no | `https://github.com/daelum/iphone-jarvis` | Repo used when create omits `repoUrl` |
| `DEFAULT_REPO_REF` | no | `main` | Starting ref |
| `JARVIS_DEV_TOKEN` | no | `dev-token` | Bearer token accepted by the auth stub |
| `APPROVAL_CHANNEL` | no | `console` | `console` (logs tickets) or `in_memory` (tests) |
| `VAULT_TTL_SECONDS` | no | `600` | Ephemeral secret TTL |

Copy `.env.example` → `.env` and fill in `CURSOR_API_KEY` for live demos.

## Run locally

```bash
cd apps/orchestrator
npm install
cp .env.example .env   # optional
npm run dev            # http://localhost:8787
```

Health check (no auth):

```bash
curl http://localhost:8787/health
```

Create an agent (auth stub):

```bash
curl -X POST http://localhost:8787/v1/agents \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"text":"Add a short CONTRIBUTING.md"}'
```

## Mobile API surface

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Liveness |
| GET | `/v1/session` | Stub session info |
| GET | `/v1/messages` | Conversation transcript |
| GET | `/v1/agents` | List Cloud Agents |
| POST | `/v1/agents` | Create agent + initial run |
| POST | `/v1/agents/:id/follow-up` | New run on existing agent |
| POST | `/v1/agents/:id/steer` | Steer active run (`delivery: steer`) |
| POST | `/v1/agents/:id/runs/:runId/cancel` | Cancel run |
| GET | `/v1/status?agentId=` | Overlay live status + pending-approval count |
| GET | `/v1/agents/:id/runs/:runId/stream` | SSE proxy to Cursor |
| GET | `/v1/approvals` | All tickets |
| GET | `/v1/approvals/pending` | Pending only |
| POST | `/v1/approvals/request-secret` | Open secret ticket (stub channel) |
| POST | `/v1/approvals/:id/approve` | Approve confirm_action |
| POST | `/v1/approvals/:id/deny` | Deny |
| POST | `/v1/approvals/:id/secret` | Seal secret into vault (value not echoed) |

## Secrets / redaction

- Never put passwords into Cursor `prompt.text`.
- Inject via `envVars` on create/follow-up (server-minted agent ids when secrets are present).
- Unit tests in `src/redaction/` and `src/cursor/client.test.ts` fail if secret-like substrings would reach the prompt payload.

## Auth

See [`src/auth/README.md`](./src/auth/README.md) for how Sign in with Apple replaces the Slice 1 stub.

## WhatsApp

**Not implemented in Slice 1.** `ConsoleStubApprovalChannel` implements the same `ApprovalChannel` port the Meta webhook worker will use. Meta setup is blocked on operator-side WABA readiness.
