# Auth stub → Sign in with Apple

Slice 1 uses a **device/session placeholder**:

- `Authorization: Bearer <JARVIS_DEV_TOKEN>` (default `dev-token`), or
- `X-Jarvis-Device-Id` + `X-Jarvis-User-Id` for quick local prototyping

The iOS app never holds a Cursor API key — only a Jarvis session token.

## How real Sign in with Apple will plug in

1. **iOS:** Add the Sign in with Apple capability; obtain an identity token (`ASAuthorizationAppleIDCredential.identityToken`).
2. **Orchestrator:** Replace `authStub` with a verifier that:
   - Fetches Apple’s JWKS (`https://appleid.apple.com/auth/keys`)
   - Validates `iss`, `aud` (your Services ID / bundle id), `exp`, and signature
   - Upserts a `users` row keyed by Apple `sub`
3. **Sessions:** Issue a short-lived Jarvis JWT / opaque session cookie after Apple verification; store refresh tokens server-side.
4. **Device binding:** Keep `X-Jarvis-Device-Id` as a secondary factor for push + overlay sessions.
5. **WhatsApp binding (later):** Link the Apple user to an allowlisted phone number before the WhatsApp approval channel can fulfill tickets.

Until then, treat `JARVIS_DEV_TOKEN` as a local-only secret — never ship it in production builds.
