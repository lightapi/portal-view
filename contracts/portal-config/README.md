# Portal runtime configuration contract, version 1

The handwritten browser validator is `src/runtimeConfig/validate.ts`; its public
types are in `src/runtimeConfig/types.ts`. The draft 2020-12 structural schema is
`public/portal-config.schema.json`. These implement WP1 of the portable signed
runtime-configuration plan. `src/bootstrap.ts` fetches `portal-config.json`
relative to `document.baseURI`, enforces the 64 KiB byte limit, validates and
deep-freezes the document, and publishes it before any authentication or
application module is imported. Application code reads it through the selectors
in `config.ts` and the URL helpers in `src/utils/runtimePaths.ts`.

Run locally from portal-view:

```sh
rtk npm run test:run -- src/runtimeConfig
rtk npx eslint src/runtimeConfig
rtk git diff --check
```

Tests enumerate every JSON file in both fixture directories with Node `fs`,
classify it by directory, and assert complete defaulted output for every valid
fixture. Invalid fixtures must throw `PortalConfigError` with a meaningful field
and message. Additional tests exercise all eleven rules and boundaries, including
Unicode character counts, final line terminators, collection limits, and decoded
query keys. These are local validator tests, not gateway or browser qualification.

## Structural and semantic boundary

Schema validation alone is insufficient. It covers required plain JSON objects,
allowed properties, authentication `oneOf`, primitive types, URL/path/UUID
patterns, string lengths, array counts, and mapping entry counts. All schema
objects use `additionalProperties: false` except the payload mapping, whose keys
are arbitrary data and whose additional values must be strings. `default` is a
schema annotation; the handwritten validator applies defaults and copies arrays
and mappings. String sizes count Unicode code points, as JSON Schema does.

Both the browser validator and the future WP8 gateway validator must also:

- Check raw URL text **before** parsing: backslashes, whitespace/controls,
  userinfo, fragments, unsafe path encodings, malformed percent escapes, shapes,
  and dot segments. Then parse the URL, including port/host validity.
- Inspect decoded OAuth query keys: exactly one non-empty `client_id`, no
  `state` or `user_type`. Other query fields are preserved. Restrictions on
  encoded separators/dots apply before `?`; query values may contain them.
- Reject repeated-hex-digit UUID placeholders, including nil/max, while accepting
  any correctly laid-out non-placeholder UUID without a version constraint.
- Enforce the redirect HTTP exception only for `localhost` and `.localhost`
  hosts. Explicit redirects have no query; absent and empty redirects remain
  distinct in validated output, and `browserRedirectUri` derives
  `<publicBasePath>/redirect` on the current origin for both.
- Reject secret-shaped schema field names, case-insensitively matching
  `secret|password|private|token|bearer|credential`. Mapping keys are data,
  exempt from that field-name check. Mapping **values** must not contain
  `secret|password|token` (case-insensitive). `__proto__` and `constructor`
  mapping keys are retained as own data properties without changing prototypes.

External links require an absolute HTTPS URL and the general string bound; they
do not inherit sign-in query, userinfo, fragment, or hostname-shape restrictions.
Feature service URLs permit empty strings, root-relative BFF endpoints, or HTTPS
URLs with rules 6.1–6.4, within the general 2048-character bound. Root-relative
endpoints use canonical segments without trailing slash or dot segments, may
contain `{apiId}`/`{version}` templates and a query, and are joined to
`routing.apiBasePath`. Feature enablement does not add an unstated non-empty URL
requirement.

In the named invalid corpus, `oauth2-has-state`, `oauth2-no-client-id`,
`entra-nil-uuid`, `entra-repeated-uuid`, and `bootstrap-entra-template`
intentionally pass structural schema
validation and require semantic rejection. Unknown/secret field fixtures also
fail schema allowlists, but the semantic validator supplies the secret diagnostic.
The 64 KiB document limit counts response bytes and is enforced by
`src/bootstrap.ts` before JSON parsing, not by this validator.

## Valid fixtures

| Fixture | What it proves |
| --- | --- |
| `k8s-entra.json` | Full design example: separate public/API prefixes, Entra IDs with UUID layout but no v4 requirement, empty derived redirect, explicit feature/link defaults. |
| `root-oauth2.json` | Root public mount, empty API prefix, absolute OAuth sign-in; explicit feature values, service URL query, payload mapping, and wizard-field overrides survive defaulting. |
| `prefixed-oauth2.json` | `/namespace-dev/service/ai/portal` public prefix, `/namespace-dev/service` API prefix, root-relative sign-in. |
| `minimal-defaults.json` | Required but empty feature/link objects receive every specified default. |
| `oauth2-relative-signin.json` | Exact relative sign-in addition with `client_id=portal-client&lang=en`; non-generated query fields survive. |
| `entra-v4-uuid.json` | Non-placeholder v4 identifiers, explicit HTTPS login redirect, `.localhost` HTTP logout redirect. |
| `feature-relative-templates.json` | Prefixed API base with a root-relative pre-registration URL carrying a query and a root-relative tools-sync `{apiId}`/`{version}` template. |

## Invalid fixtures

| Fixture | What it proves |
| --- | --- |
| `unknown-top-level.json` | Reject unknown root fields. |
| `schema-version-2.json` | Only schema version 1 is currently supported. |
| `public-trailing-slash.json` | Reject trailing slashes except the public root. |
| `public-dotdot.json` | Reject traversal path segments. |
| `public-encoded-slash.json` | Reject encoded routing separators. |
| `api-slash-only.json` | The API root uses an empty string, never `/`. |
| `api-origin-present.json` | Reject cross-origin BFF configuration. |
| `oauth2-missing-signin.json` | Require OAuth sign-in configuration. |
| `oauth2-protocol-relative.json` | Reject authority-relative URLs. |
| `oauth2-has-state.json` | Reject configured per-login state (semantic). |
| `oauth2-no-client-id.json` | Require one non-empty client identifier (semantic). |
| `entra-missing-tenant.json` | Require Entra tenant ID. |
| `entra-http-redirect.json` | Reject HTTP redirects outside the localhost exception. |
| `client-secret-field.json` | Reject secret-shaped authentication fields. Uses synthetic text only. |
| `external-link-http.json` | External links require HTTPS. |
| `oauth2-backslash-host.json` | Reject `/\other.example/login` before WHATWG normalization can change authority. |
| `oauth2-backslash-mid.json` | Reject embedded path backslashes. |
| `oauth2-encoded-slash.json` | Reject percent-encoded separators in the sign-in path. |
| `oauth2-encoded-dot.json` | Reject percent-encoded path dots. |
| `oauth2-bad-percent.json` | Reject malformed percent escapes. |
| `oauth2-userinfo.json` | Reject URL userinfo before parsing. |
| `oauth2-whitespace.json` | Reject raw whitespace. |
| `oauth2-javascript.json` | Reject non-HTTPS, non-root-relative schemes. |
| `oauth2-dotdot-segment.json` | Reject raw dot segments before parser normalization. |
| `entra-nil-uuid.json` | Reject nil UUID placeholders (semantic). |
| `entra-repeated-uuid.json` | Reject repeated-digit client UUID placeholders (semantic). |
| `entra-bad-uuid-layout.json` | Length alone does not establish UUID layout. |
| `bootstrap-entra-template.json` | Reject the nil-UUID Entra placeholder template with empty redirects (semantic). |

## Cross-language reuse

WP8 must copy these JSON files verbatim into its fixture corpus, keep their
valid/invalid classification, and run both structural and semantic validation.
Do not normalize invalid URLs before testing them. Treat these as contract
examples, not deployment configuration or credentials. light-fabric keeps a
byte-for-byte copy in `frameworks/light-pingora/tests/fixtures/portal-config`.
