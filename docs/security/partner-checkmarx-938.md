# Partner Checkmarx follow-up (#938)

This records source remediation for the six portal-view findings in
[issue #938](https://github.com/lightapi/portal-view/issues/938), excluding the
false-positive rows. Original assessment:
[partner report](https://github.com/networknt/networknt-doc/blob/master/src/security/partner-checkmarx-assessment-2026-10-28.md).
The partner's scanned revision and deployed artifact remain unknown.

| Assessment / worksheet rows | Source disposition |
| --- | --- |
| A03 / 4–5 | Both comparison cell dictionaries use null prototypes. Arbitrary IDs, including __proto__, constructor, prototype and toString, remain own data keys without changing dictionary prototypes. Regression tests cover top-level/detail cells and structured-clone worker transfer; null prototypes protect construction, not the transferred object. This removes reliance on API UUID validation for this primitive. |
| A09 / 24 | Chat client message IDs use the shared secureRandomUUID helper. The draft remains visible with an error if cryptographic generation is unavailable, including expired-session renewal. |
| A09 / 26 | Generated legacy JSON-RPC correlation IDs use a per-page sequence, avoiding both weak randomness and a Web Crypto dependency. Explicit caller JSON-RPC IDs remain unchanged. |
| A09 / 27 | Knowledge command idempotency keys use the same helper, one key per invocation. Commands requiring no idempotency key do not request one; missing Web Crypto rejects keyed commands before dispatch. |
| A10 / 25 | History confirms the old ProfileMenu generator was OAuth state, not a correlation ID. The historical generator was already replaced by cryptographic generation. Sign-in now uses secureRandomUUID, including the getRandomValues fallback. Menu tests exercise the real helper, secure state storage/redirect and a visible retryable failure without Web Crypto. |

## Cryptographic IDs

The shared UUID helper prefers native crypto.randomUUID, otherwise generates 16
bytes with crypto.getRandomValues and sets the UUID v4 version/variant bits. This
preserves chat's UUID format in contexts where randomUUID is unavailable. It
throws when neither cryptographic API is available, rather than falling back to
Math.random or a timestamp. A failed native generator is propagated without
silent downgrade. The separate createIdempotencyKey form helper already uses
Web Crypto and has a different opaque-key format; it is unchanged. clientMessageId
is a compatibility re-export of secureRandomUUID, not another implementation.
The migration covers the assessed chat, Knowledge and OAuth paths; other direct
randomUUID call sites are outside this change. It does not claim repository-wide
ID-generator consolidation.

JSON-RPC IDs only correlate responses within one page. A monotonically increasing
per-page sequence is sufficient; it is not used as an idempotency key, credential
or OAuth state. Legacy-shaped query and command calls therefore remain usable
without Web Crypto.

## Snapshot worker boundary

Null-prototype cell dictionaries prevent prototype setter execution while the
worker builds the comparison. Structured clone restores Object.prototype on the
receiving side, but preserves dangerous names such as __proto__ as own data
properties. The UI only reads cells by the snapshot IDs already populated by the
builder; it does not add new untrusted keys to transferred cells. Tests verify
that both regular and detail values survive transfer as own properties. This
change does not promise that null prototypes survive worker transfer or that
subsequent arbitrary writes to ordinary objects are safe.

## Historical OAuth evidence

- [c14f56b](https://github.com/lightapi/portal-view/commit/c14f56ba382fdfc069fa57db88966700fea3e014)
  introduced Math.random OAuth state in ProfileMenu.
- [d239afd](https://github.com/lightapi/portal-view/commit/d239afd6aedb6ce52af1c1bcebc96f98717269b9)
  moved sign-in to src/utils/signIn.ts, initially retaining the weak generator.
- [7f200a3](https://github.com/lightapi/portal-view/commit/7f200a3f93c0beeda53f6102db1732293b6cf4d3)
  replaced it with crypto.randomUUID. Current ProfileMenu delegates to that helper;
  Entra SSO delegates to MSAL instead.

The current Dashboard callback compares returned state with portal_auth_state,
removes it after a match and signs out after mismatch. This is source inspection;
no live OAuth/provider or server callback validation was exercised here. History
establishes the original purpose but does not identify the partner's exact scan
revision. Do not describe the historical weak state generator as a false positive.

## Server idempotency boundary

A09 concerns weak client-generated keys. Keys are not credentials; randomizing
one does not replace authenticated authorization or establish actor isolation.
This frontend PR does not change or qualify backend authorization/replay policy.
Deployment owners must verify the intended authenticated owner/operation scope,
cross-owner rejection and replay behavior against their deployed backend. These
are backend acceptance criteria, not conclusions established by frontend tests.

## Deployment closure

Deploy the repaired frontend, identify the backend/identity provider artifacts,
and rerun the partner scan with row-specific evidence. Source fixes and synthetic
frontend tests do not demonstrate deployed producer guarantees, live OAuth state
validation or backend cross-owner replay isolation. No live services, databases or
credentials were changed for this work.
