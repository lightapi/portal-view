import { publishPortalConfig } from "../runtimeConfig/store";
import { validatePortalConfig } from "../runtimeConfig/validate";
import type { PortalRuntimeConfig } from "../runtimeConfig/types";

type TestConfigOverrides = {
  routing?: Partial<PortalRuntimeConfig["routing"]>;
  authentication?: PortalRuntimeConfig["authentication"];
  features?: Partial<PortalRuntimeConfig["features"]>;
  externalLinks?: Partial<PortalRuntimeConfig["externalLinks"]>;
};

/** Publish explicit validated configuration; never hide missing initialization globally. */
export function publishTestConfig(overrides: TestConfigOverrides = {}) {
  return publishPortalConfig(validatePortalConfig({
    schemaVersion: 1,
    routing: { publicBasePath: "/", apiBasePath: "", ...overrides.routing },
    authentication: overrides.authentication ?? {
      mode: "oauth2", signInUrl: "https://signin.example.test?client_id=portal-client",
    },
    features: overrides.features ?? {},
    externalLinks: overrides.externalLinks ?? {},
  }));
}
