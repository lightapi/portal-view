import { describe, expect, it } from "vitest";
import { legacyPortalConfigFromEnv } from "../../server/legacyPortalConfig.mjs";
import { validatePortalConfig } from "./validate";

const cases: Record<string, string>[] = [
  {}, { VITE_API_BASE_URL: "" }, { VITE_API_BASE_URL: "/" }, { VITE_API_BASE_URL: "/bff///" },
  { VITE_API_BASE_URL: "https://dev.lightapi.net" }, { VITE_API_BASE_URL: "https://x/bff/" },
  { VITE_BASE_PATH: "/portal///", VITE_SIGNIN_URL: "/signin?client_id=x" },
  { VITE_PRE_REGISTRATION_PAYLOAD_MAPPING: "{broken" },
  { VITE_PRE_REGISTRATION_PAYLOAD_MAPPING: '{"name":"apiName"}' },
  { VITE_MCP_PRE_REGISTRATION_ENABLED: "TRUE", VITE_MCP_PRE_REGISTRATION_URL: "/register", VITE_MCP_PRE_REGISTRATION_API_ID_PATH: "result.id" },
  { VITE_TOOLS_SYNC_ENABLED: "TrUe", VITE_TOOLS_SYNC_URL: "https://registry.example/tools", VITE_TOOLS_SYNC_ERROR_PATH: "detail", VITE_WIZARD_REQUIRED_API_FIELDS: " apiDesc, region, ," },
  { VITE_SSO_ENABLED: "TRUE", VITE_TENANT_ID: "3f2b8c1e-7a4d-4e2b-9c1f-5d6e7a8b9c0d", VITE_CLIENT_ID: "e4d9217c-829a-44ce-961b-845fb6c5a82e", VITE_REDIRECT_URI: "https://portal.example/redirect" },
  { VITE_PORTAL_DOC_BASE_URL: "", VITE_API_ONBOARD_URL: "", VITE_PRODUCT_RELEASE_URL: "" },
];
describe("legacy mapping through the unchanged WP1 validator", () => {
  it.each(cases)("validates %j", env => {
    const mapped = legacyPortalConfigFromEnv(env);
    const validated = validatePortalConfig(mapped);
    expect(validated.routing).toEqual(mapped.routing);
    expect(validated.authentication).toEqual(mapped.authentication);
    expect(validated.features).toEqual(mapped.features);
    expect(validated.externalLinks).toEqual({ portalDocumentation: "https://doc.lightapi.net", apiOnboarding: "https://lightapi.net", productReleases: "https://lightapi.net/releases" });
  });
  it.each([{ VITE_PRE_REGISTRATION_PAYLOAD_MAPPING: "null" }, { VITE_PRE_REGISTRATION_PAYLOAD_MAPPING: "[]" }, { VITE_SSO_ENABLED: "true" }, { VITE_SIGNIN_URL: " " }])("does not conceal invalid mapping output %j", env => {
    expect(() => validatePortalConfig(legacyPortalConfigFromEnv(env))).toThrow();
  });
});
