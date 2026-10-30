# Jarvis iOS (Slice 1)

SwiftUI companion: conversation list, on-screen Cursor control overlay, and voice → text → same create/follow-up path as typing.

## Open in Xcode

1. On a Mac with Xcode 15+ (iOS 17 SDK):
   ```bash
   open apps/ios/Jarvis.xcodeproj
   ```
2. Select the **Jarvis** scheme and an iPhone simulator (or your device).
3. Set your **Team** under Signing & Capabilities if running on a device (`PRODUCT_BUNDLE_IDENTIFIER` is `com.daelum.jarvis`).
4. Run (⌘R).

### Simulator → orchestrator on your Mac

Default base URL is `http://127.0.0.1:8787`. Start the orchestrator first:

```bash
cd apps/orchestrator && npm install && npm run dev
```

### Physical device

Point **Settings → Base URL** at your Mac’s LAN IP, e.g. `http://192.168.1.20:8787`.  
Info.plist allows local networking (`NSAllowsLocalNetworking`). Token defaults to `dev-token` (must match `JARVIS_DEV_TOKEN`).

## What you’ll see

| Surface | Behavior |
| --- | --- |
| Conversation | Messages from orchestrator `/v1/messages` |
| Composer | Type a prompt → create agent or follow-up |
| Mic | Speech framework → transcript → same send path |
| Overlay | Status, Steer, Cancel, Open Cursor (Safari deep link), pending-approval badge |
| Settings | Orchestrator base URL + Jarvis session token |

## Out of scope (Slice 1)

- Sign in with Apple (auth stub only)
- Real WhatsApp Cloud API (approve/deny via overlay + orchestrator stub)
- Holding a Cursor API key on device (backend only)
