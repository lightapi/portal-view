import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";
import { PortalConfigError, validatePortalConfig } from "./validate";
import { SUPPORTED_SCHEMA_VERSIONS } from "./types";
import type { DeepReadonly, PortalRuntimeConfig, ReadonlyPortalRuntimeConfig } from "./types";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../../contracts/portal-config/fixtures");
const featureDefaults = {
  preRegistrationEnabled: false, preRegistrationUrl: "", preRegistrationApiIdPath: "apiId",
  preRegistrationServiceIdPath: "", preRegistrationErrorPath: "", preRegistrationPayloadMapping: {},
  toolsSyncEnabled: false, toolsSyncUrl: "", toolsSyncErrorPath: "",
  wizardRequiredApiFields: ["categoryIds", "apiDesc", "region", "businessGroup", "lob", "platform"],
};
const linkDefaults = {
  portalDocumentation: "https://doc.lightapi.net", apiOnboarding: "https://lightapi.net",
  productReleases: "https://lightapi.net/releases",
};
const entra = {
  mode: "entra-sso", tenantId: "11111111-2222-3333-4444-555555555555",
  clientId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
};

function base(): Record<string, any> {
  return {
    schemaVersion: 1, routing: { publicBasePath: "/", apiBasePath: "" },
    authentication: { mode: "oauth2", signInUrl: "/signin?client_id=portal" },
    features: {}, externalLinks: {},
  };
}

function configured(field: string, value: unknown, sso = false): Record<string, any> {
  const candidate = base();
  if (sso) candidate.authentication = { ...entra };
  const parts = field.split(".");
  const key = parts.pop()!;
  let target = candidate;
  for (const part of parts) target = target[part];
  target[key] = value;
  return candidate;
}

function rejects(candidate: unknown, field: string, message?: RegExp): void {
  let caught: unknown;
  try { validatePortalConfig(candidate); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(PortalConfigError);
  const error = caught as PortalConfigError;
  expect(error.field).toBe(field);
  expect(error.message.length).toBeGreaterThan(0);
  if (message) expect(error.message).toMatch(message);
}

describe("shared fixtures, loaded verbatim from disk", () => {
  for (const category of ["valid", "invalid"] as const) {
    const files = readdirSync(join(fixtures, category)).filter((name) => name.endsWith(".json")).sort();
    it(`${category} fixture directory is populated`, () => expect(files.length).toBeGreaterThan(0));
    for (const file of files) {
      it(`${category}/${file}`, () => {
        const candidate = JSON.parse(readFileSync(join(fixtures, category, file), "utf8"));
        if (category === "valid") {
          expect(validatePortalConfig(candidate)).toEqual({
            ...candidate, features: { ...featureDefaults, ...candidate.features },
            externalLinks: { ...linkDefaults, ...candidate.externalLinks },
          });
        } else {
          expect(() => validatePortalConfig(candidate)).toThrow(PortalConfigError);
          try { validatePortalConfig(candidate); } catch (error) {
            expect((error as PortalConfigError).field).toMatch(/^(schemaVersion|unexpected|routing\.|authentication\.|externalLinks\.)/);
            expect((error as PortalConfigError).message).not.toBe("");
          }
        }
      });
    }
  }
});

describe("rules 1, 2, 5: object structure, required fields, and authentication modes", () => {
  it.each([null, undefined, [], true, 1, "{}", new Date(), new Map(), Object.create({ routing: {} })])(
    "rejects non-plain top-level candidate %#", (value) => rejects(value, "$"),
  );
  it.each(["routing", "authentication", "features", "externalLinks"])("requires plain %s", (field) => {
    for (const value of [undefined, null, [], "{}", true, new Date()]) rejects(configured(field, value), field);
    const candidate = base(); delete candidate[field]; rejects(candidate, field);
  });
  it.each(["routing.publicBasePath", "routing.apiBasePath", "authentication.signInUrl"])("requires %s", (field) => {
    for (const value of [undefined, null, 4, [], false]) rejects(configured(field, value), field);
  });
  it.each(["extra", "routing.apiOrigin", "authentication.tenantId", "features.extra", "externalLinks.extra"])(
    "rejects unknown field %s", (field) => rejects(configured(field, "unexpected"), field, /Unknown/),
  );
  it("accepts null-prototype JSON-like objects", () => {
    const candidate = Object.assign(Object.create(null), base());
    candidate.features = Object.create(null);
    expect(validatePortalConfig(candidate).features).toEqual(featureDefaults);
  });
  it.each([undefined, null, "1", 0, 2, 1.5, true, NaN, Infinity])("rejects unsupported schema %#", (value) => {
    rejects(configured("schemaVersion", value), "schemaVersion");
  });
  it.each([undefined, null, "", "OAuth2", "saml", true])("rejects unsupported auth mode %#", (value) => {
    rejects(configured("authentication.mode", value), "authentication.mode");
  });
  it.each(["tenantId", "clientId", "redirectUri", "postLogoutRedirectUri"])("rejects OAuth mode field %s", (key) => {
    rejects(configured(`authentication.${key}`, ""), `authentication.${key}`);
  });
  it("rejects OAuth signInUrl in Entra mode", () => rejects(configured("authentication.signInUrl", "/login", true), "authentication.signInUrl"));
  it("exports the supported schema and deeply readonly types", () => {
    expect(SUPPORTED_SCHEMA_VERSIONS).toEqual([1]);
    expectTypeOf<ReadonlyPortalRuntimeConfig>().toEqualTypeOf<DeepReadonly<PortalRuntimeConfig>>();
    expectTypeOf<ReadonlyPortalRuntimeConfig["features"]["wizardRequiredApiFields"]>().toEqualTypeOf<readonly string[]>();
  });
});

describe("rules 3 and 4: canonical routing paths", () => {
  it.each(["\n", "\r", "\u2028", "\u2029"])("rejects final line terminators %# without regex anchor normalization", (suffix) => {
    for (const field of ["routing.publicBasePath", "routing.apiBasePath", "features.preRegistrationUrl", "features.toolsSyncUrl"]) {
      rejects(configured(field, "/portal" + suffix), field);
    }
    for (const field of ["authentication.tenantId", "authentication.clientId"]) {
      rejects(configured(field, entra.tenantId + suffix, true), field);
    }
  });
  const invalid = ["/", "relative", "//host", "/a/", "/a//b", "/.", "/..", "/a/./b", "/a/../b",
    "/a%2fb", "/a%2Fb", "/a%5cb", "/a%5Cb", "/a%20b", "/a\\b", "/a?b", "/a#b", "/a b", "/a\nb", "https://host/a"];
  it.each(["routing.publicBasePath", "routing.apiBasePath"])("validates %s", (field) => {
    for (const value of invalid.filter((v) => !(field.endsWith("publicBasePath") && v === "/"))) {
      rejects(configured(field, value), field);
    }
    for (const value of ["/a", "/.well-known", "/a..b", "/a/b", "/A09._~!$&'()*+,;=:@-"]) {
      expect(() => validatePortalConfig(configured(field, value))).not.toThrow();
    }
    expect(() => validatePortalConfig(configured(field, "/" + "a".repeat(255)))).not.toThrow();
    rejects(configured(field, "/" + "a".repeat(256)), field, /256/);
  });
  it("distinguishes empty API prefix from public root", () => {
    expect(validatePortalConfig(base()).routing).toEqual({ publicBasePath: "/", apiBasePath: "" });
    rejects(configured("routing.publicBasePath", ""), "routing.publicBasePath");
    rejects(configured("routing.apiBasePath", "/"), "routing.apiBasePath");
  });
});

describe("rule 6: raw sign-in URL and decoded query semantics", () => {
  const field = "authentication.signInUrl";
  it.each([
    "", "/signin", "/signin?client_id=", "/signin?client_id", "/signin?CLIENT_ID=x",
    "/signin?client_id=x&client_id=y", "/signin?client_id=x&client_id=", "/signin?client_id=x&%63lient_id=y",
    "/signin?client_id=x&state=", "/signin?client_id=x&user_type=E", "/signin?client_id=x&%73tate=z",
    "/signin?client_id=x&user%5ftype=E", "//host/signin?client_id=x", "signin?client_id=x",
    "http://localhost/signin?client_id=x", "javascript:alert(1)?client_id=x", "HTTPS://host?client_id=x",
    "/\\other.example/login?client_id=x", "/sign\\in?client_id=x", "/signin?client_id=x\\y",
    "/signin?client_id=x#", "https://u:p@host/signin?client_id=x", "/a@b?client_id=x",
    "/signin?client_id=x ", " /signin?client_id=x", "/si\ngnin?client_id=x", "/signin?client_id=\tx",
    "/signin?client_id=\u0000x", "/signin?client_id=\u007fx", "/signin?client_id=\u00a0x",
    "/%2fhost?client_id=x", "/%5Chost?client_id=x", "/%2E/login?client_id=x", "/a%2eb?client_id=x",
    "/%?client_id=x", "/%2?client_id=x", "/%xz?client_id=x", "/signin?client_id=%z0",
    "/./signin?client_id=x", "/a/../signin?client_id=x", "https://host/a/..?client_id=x",
    "https:///signin?client_id=x", "https://host:123456/?client_id=x", "https://host:65536/?client_id=x",
    "https://[::1]/?client_id=x", "https://host_name/?client_id=x",
  ])("rejects unsafe sign-in %#", (value) => rejects(configured(field, value), field));
  it.each([
    "/?client_id=x", "/signin?client_id=x", "https://host?client_id=x", "https://host:65535/?client_id=x",
    "/.well-known/signin?client_id=x", "/a//signin?client_id=x", "/signin/?client_id=x",
    "/sign%69n?%63lient_id=x", "/signin?client_id=x&lang=en&lang=fr", "/signin?client_id=x?y",
    "/signin?client_id=x&next=%2F%2E%5C&email=a@b", "/signin?client_id=%20",
    "/signin?client_id=x&STATE=retained&USER_TYPE=retained", "/signin?client_id=x&access_token=public-text",
  ])("accepts contract-permitted sign-in %# without rewriting", (value) => {
    expect(validatePortalConfig(configured(field, value)).authentication).toEqual({ mode: "oauth2", signInUrl: value });
  });
  it("enforces the 2048 character boundary", () => {
    const prefix = "/signin?client_id=";
    const value = prefix + "x".repeat(2048 - prefix.length);
    expect(() => validatePortalConfig(configured(field, value))).not.toThrow();
    rejects(configured(field, value + "x"), field, /2048/);
  });
});

describe("rule 7: UUID layout, placeholders, and explicit redirects", () => {
  it.each(["tenantId", "clientId"])("validates %s", (key) => {
    const field = `authentication.${key}`;
    for (const value of [undefined, null, 123, "", "1111111122223333444455555555555555-1", "z1111111-2222-3333-4444-555555555555"]) {
      rejects(configured(field, value, true), field);
    }
    for (const digit of "0123456789abcdefABCDEF") {
      rejects(configured(field, [8, 4, 4, 4, 12].map((n) => digit.repeat(n)).join("-"), true), field, /Placeholder/);
    }
    rejects(configured(field, "aAaAaAaA-aAaA-aAaA-aAaA-aAaAaAaAaAaA", true), field, /Placeholder/);
    for (const value of [entra.tenantId, entra.clientId.toUpperCase(), "3f2b8c1e-7a4d-0e2b-0c1f-5d6e7a8b9c0d"]) {
      expect(() => validatePortalConfig(configured(field, value, true))).not.toThrow();
    }
  });
  it.each(["redirectUri", "postLogoutRedirectUri"])("validates %s with exactly the localhost exception", (key) => {
    const field = `authentication.${key}`;
    for (const value of ["", "https://example.com", "https://other.example.com/path/", "http://localhost",
      "http://LOCALHOST:3000/redirect", "http://portal.localhost/redirect", "http://a.b.localhost/redirect"]) {
      expect(validatePortalConfig(configured(field, value, true)).authentication).toMatchObject({ [key]: value });
    }
    for (const value of [null, undefined, 123, "/redirect", "//localhost/redirect", "http://127.0.0.1/redirect",
      "http://localhost.evil/redirect", "http://notlocalhost/redirect", "http://localhost./redirect", "https://host/redirect?",
      "https://host/redirect?x=1", "https://host/redirect#x", "https://user@host/redirect", "https://host/a/../redirect",
      "http://localhost/%2e/redirect", "https://host/redirect%zz", "https://host\\redirect", "https://host/ redir"]) {
      rejects(configured(field, value, true), field);
    }
    const candidate = base(); candidate.authentication = { ...entra };
    expect(validatePortalConfig(candidate).authentication).not.toHaveProperty(key);
    const prefix = "https://example.com/";
    const boundary = prefix + "x".repeat(2048 - prefix.length);
    expect(() => validatePortalConfig(configured(field, boundary, true))).not.toThrow();
    rejects(configured(field, boundary + "x", true), field, /2048/);
  });
});

describe("rules 8 and 9: feature destinations and external links", () => {
  it.each(["preRegistrationUrl", "toolsSyncUrl"])("validates feature %s", (key) => {
    const field = `features.${key}`;
    for (const value of ["", "/", "/api/register", "https://service.example.com/", "https://service.example.com/sync?q=a@b&state=static",
      "/sync?x=1", "/register?source=portal&next=/a%2Fb", "/registry/apis/{apiId}/versions/{version}/tools"]) {
      expect(() => validatePortalConfig(configured(field, value))).not.toThrow();
    }
    for (const value of [null, 42, "/sync/", "/a//sync", "/a/../sync", "/./sync", "/a%2Fb", "/a%2e%2e/b", "/a%20b", "/sync#x",
      "/sy nc", "/sy\\nc", "/sync?x=%zz", "//host", "http://localhost/sync",
      "https://host/%2Fsync", "https://host/a/../sync", "https://user@host/sync", "https://host/sync#x",
      "https://host/sync?x=%zz", "https://host/sy nc", "https://host/sy\\nc"]) {
      rejects(configured(field, value), field);
    }
    expect(() => validatePortalConfig(configured(field, "/" + "x".repeat(2047)))).not.toThrow();
    rejects(configured(field, "/" + "x".repeat(2048)), field, /2048/);
    const prefix = "https://host/";
    expect(() => validatePortalConfig(configured(field, prefix + "x".repeat(2048 - prefix.length)))).not.toThrow();
    rejects(configured(field, prefix + "x".repeat(2049 - prefix.length)), field, /2048/);
  });
  it.each(Object.keys(linkDefaults))("requires absolute HTTPS for %s without importing sign-in restrictions", (key) => {
    const field = `externalLinks.${key}`;
    for (const value of ["https://docs.example.com/guide?q=x#section", "https://user@docs.example.com/guide", "HTTPS://docs.example.com/", "https://[::1]/"]) {
      expect(() => validatePortalConfig(configured(field, value))).not.toThrow();
    }
    for (const value of [null, 42, "", "/docs", "//host/docs", "http://localhost/docs", "https:docs", "javascript:alert(1)", "https://host:99999/"]) {
      rejects(configured(field, value), field);
    }
    const prefix = "https://host/";
    expect(() => validatePortalConfig(configured(field, prefix + "x".repeat(2048 - prefix.length)))).not.toThrow();
    rejects(configured(field, prefix + "x".repeat(2049 - prefix.length)), field, /2048/);
  });
});

describe("rules 10 and 11: sizes, types, secrets, and defaults", () => {
  it.each(["preRegistrationEnabled", "toolsSyncEnabled"])("requires native boolean %s", (key) => {
    for (const value of [true, false]) expect(validatePortalConfig(configured(`features.${key}`, value)).features[key as "toolsSyncEnabled"]).toBe(value);
    for (const value of [null, undefined, "true", "false", 0, 1]) rejects(configured(`features.${key}`, value), `features.${key}`);
  });
  it.each(["preRegistrationApiIdPath", "preRegistrationServiceIdPath", "preRegistrationErrorPath", "toolsSyncErrorPath"])("bounds string %s", (key) => {
    const field = `features.${key}`;
    for (const value of ["", " ", "x".repeat(2048), "😀".repeat(2048)]) expect(() => validatePortalConfig(configured(field, value))).not.toThrow();
    for (const value of [null, undefined, true, {}, [], "x".repeat(2049)]) rejects(configured(field, value), field);
  });
  it("bounds arrays and each item, permitting empty and duplicate strings", () => {
    const field = "features.wizardRequiredApiFields";
    for (const value of [[], ["", ""], Array(32).fill("x".repeat(64)), ["😀".repeat(64)]]) {
      expect(() => validatePortalConfig(configured(field, value))).not.toThrow();
    }
    for (const value of [null, "a,b", {}, Array(33).fill("x")]) rejects(configured(field, value), field);
    for (const value of [["x".repeat(65)], [null], [123], [undefined], Array(1)]) rejects(configured(field, value), `${field}[0]`);
  });
  it("bounds mappings, mapping keys and values; requires plain objects and string values", () => {
    const field = "features.preRegistrationPayloadMapping";
    const entries = Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`key${i}`, "x".repeat(2048)]));
    expect(() => validatePortalConfig(configured(field, entries))).not.toThrow();
    rejects(configured(field, { ...entries, overflow: "x" }), field, /64/);
    for (const value of [null, undefined, [], "{}", new Map()]) rejects(configured(field, value), field);
    for (const value of [null, undefined, 1, false, [], {}, "x".repeat(2049)]) rejects(configured(field, { key: value }), `${field}.key`);
    expect(() => validatePortalConfig(configured(field, { ["x".repeat(2048)]: "" }))).not.toThrow();
    rejects(configured(field, { ["x".repeat(2049)]: "" }), `${field}.${"x".repeat(2049)}`);
  });
  it.each(["clientSecret", "PASSWORD", "privateKey", "accessToken", "BEARER", "credentialValue"])("rejects secret-shaped schema key %s", (key) => {
    for (const parent of ["", "routing.", "authentication.", "features.", "externalLinks."]) {
      rejects(configured(parent + key, "synthetic"), parent + key, /Secret-shaped/);
    }
  });
  it("treats mapping keys as data, safely retaining special object keys", () => {
    const mapping = JSON.parse('{"secret":"apiId","PASSWORD":"name","accessToken":"id","private":"id","bearer":"id","credential":"id","__proto__":"id","constructor":"id","":""}');
    const output = validatePortalConfig(configured("features.preRegistrationPayloadMapping", mapping));
    expect(output.features.preRegistrationPayloadMapping).toEqual(mapping);
    expect(Object.getPrototypeOf(output.features.preRegistrationPayloadMapping)).toBe(Object.prototype);
  });
  it.each(["clientSECRET", "data.Password", "accessToken"])("rejects mapping value %s", (value) => {
    rejects(configured("features.preRegistrationPayloadMapping", { key: value }), "features.preRegistrationPayloadMapping.key", /Mapping values/);
  });
  it("does not widen the mapping-value restriction to private, bearer, or credential", () => {
    expect(() => validatePortalConfig(configured("features.preRegistrationPayloadMapping", { a: "private", b: "bearer", c: "credential" }))).not.toThrow();
  });
  it("defaults absent fields only, retains explicit empties, and returns independent copies", () => {
    const candidate = base();
    const snapshot = JSON.stringify(candidate);
    const first = validatePortalConfig(candidate);
    expect(first.features).toEqual(featureDefaults);
    expect(first.externalLinks).toEqual(linkDefaults);
    expect(JSON.stringify(candidate)).toBe(snapshot);
    first.features.wizardRequiredApiFields.push("extra");
    first.features.preRegistrationPayloadMapping.extra = "apiId";
    expect(validatePortalConfig(candidate).features).toEqual(featureDefaults);
    candidate.features = { preRegistrationApiIdPath: "", wizardRequiredApiFields: ["x"], preRegistrationPayloadMapping: { id: "apiId" } };
    const output = validatePortalConfig(candidate);
    expect(output.features.preRegistrationApiIdPath).toBe("");
    expect(output.features.wizardRequiredApiFields).not.toBe(candidate.features.wizardRequiredApiFields);
    expect(output.features.preRegistrationPayloadMapping).not.toBe(candidate.features.preRegistrationPayloadMapping);
    expect(output.routing).not.toBe(candidate.routing);
    expect(output.authentication).not.toBe(candidate.authentication);
  });
  it("leaves document byte-size enforcement to the WP3 caller", () => {
    const candidate = configured("features.preRegistrationPayloadMapping", Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`k${i}`, "x".repeat(2048)])));
    expect(JSON.stringify(candidate).length).toBeGreaterThan(64 * 1024);
    expect(() => validatePortalConfig(candidate)).not.toThrow();
  });
  it("reports the first violation deterministically without echoing candidate values", () => {
    const candidate = base(); candidate.schemaVersion = 2; candidate.routing.publicBasePath = "invalid";
    rejects(candidate, "schemaVersion");
    rejects(configured("authentication.signInUrl", "sensitive-invalid-value"), "authentication.signInUrl", /allowed/);
  });
});
