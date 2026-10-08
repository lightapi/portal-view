import assert from "node:assert/strict";
import { test } from "node:test";
import { legacyPortalConfigFromEnv as map, legacyBaseHref, portalLegacyRuntimeConfig as plugin } from "./legacyPortalConfig.mjs";

for (const [input, expected] of [["", ""], ["/", ""], ["/bff///", "/bff"], ["https://dev.lightapi.net", ""], ["https://x/bff/", "/bff"], ["https://x/bff/?a=b", "/bff"]]) {
  test(`API base ${input}`, () => assert.equal(map({ VITE_API_BASE_URL: input }).routing.apiBasePath, expected));
}
for (const [input, expected] of [["", "/"], ["/", "/"], ["/portal/", "/portal"], ["/portal///", "/portal"]]) {
  test(`public base ${input}`, () => {
    assert.equal(map({ VITE_BASE_PATH: input }).routing.publicBasePath, expected);
    assert.equal(legacyBaseHref({ VITE_BASE_PATH: input }), expected === "/" ? "/" : expected + "/");
  });
}
test("OAuth fallback is only used for an empty sign-in setting", () => {
  const fallback = "https://signin.localhost?client_id=f7d42348-c647-4efb-a52d-4c5787421e72";
  for (const env of [{}, { VITE_SIGNIN_URL: "" }, { VITE_SSO_ENABLED: "false" }]) assert.deepEqual(map(env).authentication, { mode: "oauth2", signInUrl: fallback });
  for (const signInUrl of ["/signin?client_id=x", "https://signin.example.com?client_id=x", " "]) {
    assert.equal(map({ VITE_SIGNIN_URL: signInUrl }).authentication.signInUrl, signInUrl);
  }
});
test("SSO case-insensitivity and optional redirect; mapping remains pure", () => {
  const env = Object.freeze({ VITE_SSO_ENABLED: "TRUE", VITE_TENANT_ID: "tenant", VITE_CLIENT_ID: "client", VITE_REDIRECT_URI: "https://portal.example/redirect" });
  assert.deepEqual(map(env).authentication, { mode: "entra-sso", tenantId: "tenant", clientId: "client", redirectUri: env.VITE_REDIRECT_URI });
  assert.equal(Object.hasOwn(map({ ...env, VITE_REDIRECT_URI: "" }).authentication, "redirectUri"), false);
  assert.deepEqual(map({ VITE_SSO_ENABLED: "true" }).authentication, { mode: "entra-sso", tenantId: "", clientId: "" });
});
test("all historical feature fields and primary-over-fallback precedence", () => {
  const env = { VITE_MCP_PRE_REGISTRATION_ENABLED: "TRUE", VITE_MCP_PRE_REGISTRATION_URL: " /register ", VITE_MCP_PRE_REGISTRATION_API_ID_PATH: " result.id " };
  assert.deepEqual(map(env).features, {
    preRegistrationEnabled: true, preRegistrationUrl: "/register", preRegistrationApiIdPath: "result.id",
    preRegistrationServiceIdPath: "", preRegistrationErrorPath: "", preRegistrationPayloadMapping: {},
    toolsSyncEnabled: false, toolsSyncUrl: "", toolsSyncErrorPath: "",
    wizardRequiredApiFields: ["categoryIds", "apiDesc", "region", "businessGroup", "lob", "platform"],
  });
  const features = map({ ...env, VITE_PRE_REGISTRATION_ENABLED: "", VITE_PRE_REGISTRATION_URL: "", VITE_PRE_REGISTRATION_API_ID_PATH: "", VITE_PRE_REGISTRATION_SERVICE_ID_PATH: " service.id ", VITE_PRE_REGISTRATION_ERROR_PATH: " error.message ", VITE_PRE_REGISTRATION_PAYLOAD_MAPPING: '{"name":"apiName"}', VITE_TOOLS_SYNC_ENABLED: "TrUe", VITE_TOOLS_SYNC_URL: " https://registry.example/tools ", VITE_TOOLS_SYNC_ERROR_PATH: " detail ", VITE_WIZARD_REQUIRED_API_FIELDS: " apiDesc, region, ," }).features;
  assert.deepEqual(features, { preRegistrationEnabled: false, preRegistrationUrl: "", preRegistrationApiIdPath: "apiId", preRegistrationServiceIdPath: "service.id", preRegistrationErrorPath: "error.message", preRegistrationPayloadMapping: { name: "apiName" }, toolsSyncEnabled: true, toolsSyncUrl: "https://registry.example/tools", toolsSyncErrorPath: "detail", wizardRequiredApiFields: ["apiDesc", "region"] });
  assert.deepEqual(map({ VITE_WIZARD_REQUIRED_API_FIELDS: "" }).features.wizardRequiredApiFields, []);
});
test("mapping parse failure falls back, while parsed invalid shapes remain for browser validation", () => {
  for (const value of ["", "{broken"]) assert.deepEqual(map({ VITE_PRE_REGISTRATION_PAYLOAD_MAPPING: value }).features.preRegistrationPayloadMapping, {});
  assert.equal(map({ VITE_PRE_REGISTRATION_PAYLOAD_MAPPING: "null" }).features.preRegistrationPayloadMapping, null);
});
test("empty external links are omitted; configured links are mapped", () => {
  assert.deepEqual(map({ VITE_PORTAL_DOC_BASE_URL: "", VITE_API_ONBOARD_URL: " ", VITE_PRODUCT_RELEASE_URL: "" }).externalLinks, {});
  assert.deepEqual(map({ VITE_PORTAL_DOC_BASE_URL: "https://docs.example", VITE_API_ONBOARD_URL: "https://onboard.example", VITE_PRODUCT_RELEASE_URL: "https://releases.example" }).externalLinks, { portalDocumentation: "https://docs.example", apiOnboarding: "https://onboard.example", productReleases: "https://releases.example" });
});
test("plugin applies to serve and legacy builds, never release builds", () => {
  for (const mode of ["development", "production", "release"]) {
    const p = plugin({}, { mode });
    assert.equal(p.apply({}, { command: "serve" }), true);
    assert.equal(p.apply({}, { command: "build" }), mode !== "release");
  }
});
test("HTML base replacement escapes every attribute delimiter", () => {
  const p = plugin({ VITE_BASE_PATH: `/a&b"'<x>/` }, { mode: "production" });
  assert.equal(p.transformIndexHtml('<base href="__PORTAL_BASE_HREF__">'), '<base href="/a&amp;b&quot;&#39;&lt;x&gt;/">');
});
test("GET/HEAD middleware uses exact prefixed endpoint and no-store; build emits identical JSON", () => {
  const env = { VITE_BASE_PATH: "/portal/", VITE_SIGNIN_URL: "https://signin.example.com?client_id=x" };
  const p = plugin(env, { mode: "production" });
  let middleware;
  p.configureServer({ middlewares: { use(value) { middleware = value; } } });
  for (const method of ["GET", "HEAD"]) {
    const headers = {}; let body = "not ended";
    const response = { setHeader(k, v) { headers[k] = v; }, end(value) { body = value; } };
    middleware({ method, url: "/portal/portal-config.json?fresh=1" }, response, () => assert.fail("unexpected passthrough"));
    assert.equal(response.statusCode, 200);
    assert.deepEqual(headers, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    assert.equal(body, method === "HEAD" ? undefined : JSON.stringify(map(env)));
  }
  for (const [method, url] of [["POST", "/portal/portal-config.json"], ["GET", "/portal-config.json"], ["GET", "/portal/portal-config.json/extra"], ["GET", "/portal/app/a"]]) {
    let passed = false; middleware({ method, url }, {}, () => { passed = true; }); assert.equal(passed, true);
  }
  let asset;
  p.generateBundle.call({ emitFile(value) { asset = value; } });
  assert.deepEqual(asset, { type: "asset", fileName: "portal-config.json", source: JSON.stringify(map(env)) });
});
test("integration diagnoses ignored API origin and missing SSO IDs without printing config", () => {
  const warnings = [], errors = [];
  const logger = { warn(value) { warnings.push(value); }, error(value) { errors.push(value); } };
  plugin({ VITE_API_BASE_URL: "https://private.example/bff" }, { mode: "production" }).configResolved({ logger });
  assert.deepEqual(warnings, ["VITE_API_BASE_URL origin is ignored; the BFF must be same-origin"]);
  for (const env of [{}, { VITE_TENANT_ID: "tenant" }, { VITE_CLIENT_ID: "client" }]) {
    assert.throws(() => plugin({ ...env, VITE_SSO_ENABLED: "true" }, { mode: "production" }).configResolved({ logger }), /requires non-empty VITE_TENANT_ID and VITE_CLIENT_ID/);
  }
  assert.equal(errors.length, 3);
  plugin({ VITE_SSO_ENABLED: "false", VITE_API_BASE_URL: "/bff" }, { mode: "production" }).configResolved({ logger });
  assert.equal(warnings.length, 1);
});
