# Partner Checkmarx follow-up (#938)

This records source remediation for the six portal-view findings in
[issue #938](https://github.com/lightapi/portal-view/issues/938), excluding the
false-positive rows. Original assessment:
[partner report](https://github.com/networknt/networknt-doc/blob/master/src/security/partner-checkmarx-assessment-2026-10-28.md).
The partner's scanned revision and deployed artifact remain unknown.

| Assessment / worksheet rows | Source disposition |
| --- | --- |
| A03 / 4–5 | Both comparison cell dictionaries use null prototypes. Arbitrary IDs, including __proto__, constructor, prototype and toString, remain own data keys without changing dictionary prototypes. Regression tests cover top-level/detail cells and structured-clone worker transfer. This removes reliance on API UUID validation for this primitive. |
| A09 / 24 | Chat client message IDs use the shared secureRandomUUID helper. The draft remains visible with an error if cryptographic generation is unavailable, including expired-session renewal. |
| A09 / 26 | Generated legacy JSON-RPC IDs use the same helper; explicit caller JSON-RPC IDs remain unchanged. Missing Web Crypto rejects before fetch. |
| A09 / 27 | Knowledge command idempotency keys use the same helper, one key per invocation. Commands requiring no idempotency key do not request one; missing Web Crypto rejects keyed commands before dispatch. |
| A10 / 25 | History confirms the old ProfileMenu generator was OAuth state, not a correlation ID. It has already been replaced by cryptographic generation in the shared sign-in helper. New regression coverage locks in ProfileMenu delegation, secure state use and failure before redirect/storage without secure UUID support. |

## Cryptographic IDs

The shared UUID helper prefers native crypto.randomUUID, otherwise generates 16
bytes with crypto.getRandomValues and sets the UUID v4 version/variant bits. This
preserves chat's UUID format in contexts where randomUUID is unavailable. It
throws when neither cryptographic API is available, rather than falling back to
Math.random or a timestamp. A failed native generator is propagated without
silent downgrade. The separate createIdempotencyKey form helper already uses
Web Crypto and has a different opaque-key format; it is unchanged.

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
Read-only source checks found:

- light-portal at a8da0c88ee3fb8178dd43c2a02495d6b99084c69:
  command/genai-command/.../KnowledgeCommands.java requires verified audit identity
  and delegates operational commands with Authorization and Idempotency-Key.
- light-fabric at 60f1a91e07503ec9ed36d019f00cdadaa688375b:
  apps/light-knowledge-admin/src/lib.rs authorizes commands, checks environment and
  knowledge-base owner visibility before job lookup, and scopes replay lookup to
  (knowledge_base_id, idempotency_key). Conflicting operation/data returns a conflict.
  Same-payload replay is shared within that authorized knowledge-base scope;
  the lookup is not scoped to an individual actor.

These are source observations, not backend isolation tests or a claim that every
create/operational command has been qualified. This frontend PR does not change
backend authorization/replay policy. Deployment owners must verify the intended
owner scope, cross-owner rejection and replay behavior with their deployed backend;
if per-actor replay isolation is required, track that backend policy separately.

## Deployment closure

Deploy the repaired frontend, identify the backend/identity provider artifacts,
and rerun the partner scan with row-specific evidence. Source fixes and synthetic
frontend tests do not demonstrate deployed producer guarantees, live OAuth state
validation or backend cross-owner replay isolation. No live services, databases or
credentials were changed for this work.
