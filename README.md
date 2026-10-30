# Cursor Jarvis

**iPhone control surface for Cursor Cloud Agents** — conversation + voice + on-screen overlay. A TypeScript orchestrator drives the [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/overview); WhatsApp (Meta Cloud API) will later approve risky actions and collect secrets. There is no desktop IDE remote-control API.

## Layout

```
apps/
  orchestrator/   # Node/TypeScript HTTPS API + Cursor adapter + vault/approval stub
  ios/            # SwiftUI app (Jarvis.xcodeproj)
```

## Slice 1 (this PR)

| Ship | Status |
| --- | --- |
| Orchestrator health, auth stub, create / follow-up / steer / cancel | ✅ |
| Cursor Cloud Agents API v1 adapter + SSE stream proxy | ✅ |
| Approval tickets + ephemeral vault; **console/in-app stub** channel | ✅ |
| Redaction — secrets never in `prompt.text`; inject via `envVars` | ✅ |
| iOS conversation UI + overlay + voice v0 + deep link to agent URL | ✅ |
| Real WhatsApp Cloud API | ❌ deferred (Meta / WABA not ready) |
| Desktop IDE remote control | ❌ not available publicly — do not invent |

## Quick start

### Orchestrator

```bash
cd apps/orchestrator
npm install
cp .env.example .env   # set CURSOR_API_KEY for live agents
npm run dev            # http://localhost:8787
```

Without `CURSOR_API_KEY`, the API runs in **mock mode** so the iOS shell still works end-to-end.

Details: [`apps/orchestrator/README.md`](./apps/orchestrator/README.md)

### iOS

```bash
open apps/ios/Jarvis.xcodeproj
```

Details: [`apps/ios/README.md`](./apps/ios/README.md)

## WhatsApp later

Approval tickets and the vault use an `ApprovalChannel` port. Slice 1 ships `ConsoleStubApprovalChannel` (+ in-app approve/deny). When Meta Business / WhatsApp Cloud API is ready, swap in the webhook worker — no rewrite of ticket/vault contracts. Operator setup guide lives in the project store (`docs/whatsapp-cloud-api-setup.md`), not in this repo yet.

## Auth note

iOS holds only a Jarvis session token (`JARVIS_DEV_TOKEN` stub). The Cursor org API key stays on the orchestrator. Sign in with Apple plugs in as documented under `apps/orchestrator/src/auth/README.md`.
