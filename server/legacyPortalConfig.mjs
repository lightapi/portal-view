const DEFAULT_FIELDS = "categoryIds,apiDesc,region,businessGroup,lob,platform";
const DEFAULT_SIGN_IN = "https://signin.localhost?client_id=f7d42348-c647-4efb-a52d-4c5787421e72";
const enabled = value => String(value ?? "false").toLowerCase() === "true";
const trimmed = value => String(value ?? "").trim();
const normalizedPath = value => trimmed(value).replace(/\/+$/, "");

function apiBase(env) {
  const value = trimmed(env.VITE_API_BASE_URL);
  return normalizedPath(/^[a-z][a-z0-9+.-]*:/i.test(value) ? new URL(value).pathname : value);
}

/** Legacy build/dev compatibility only; never imported by browser code. */
export function legacyPortalConfigFromEnv(env) {
  let mapping = {};
  try { mapping = JSON.parse(trimmed(env.VITE_PRE_REGISTRATION_PAYLOAD_MAPPING) || "{}"); }
  catch { /* Preserve the historical invalid-JSON fallback. */ }
  const authentication = enabled(env.VITE_SSO_ENABLED)
    ? { mode: "entra-sso", tenantId: env.VITE_TENANT_ID ?? "", clientId: env.VITE_CLIENT_ID ?? "",
        ...(env.VITE_REDIRECT_URI ? { redirectUri: env.VITE_REDIRECT_URI } : {}) }
    : { mode: "oauth2", signInUrl: env.VITE_SIGNIN_URL || DEFAULT_SIGN_IN };
  const externalLinks = {};
  for (const [key, variable] of Object.entries({
    portalDocumentation: "VITE_PORTAL_DOC_BASE_URL", apiOnboarding: "VITE_API_ONBOARD_URL",
    productReleases: "VITE_PRODUCT_RELEASE_URL",
  })) {
    const value = trimmed(env[variable]);
    if (value) externalLinks[key] = value;
  }
  return {
    schemaVersion: 1,
    routing: { publicBasePath: normalizedPath(env.VITE_BASE_PATH) || "/", apiBasePath: apiBase(env) },
    authentication,
    features: {
      preRegistrationEnabled: enabled(env.VITE_PRE_REGISTRATION_ENABLED ?? env.VITE_MCP_PRE_REGISTRATION_ENABLED),
      preRegistrationUrl: trimmed(env.VITE_PRE_REGISTRATION_URL ?? env.VITE_MCP_PRE_REGISTRATION_URL),
      preRegistrationApiIdPath: trimmed(env.VITE_PRE_REGISTRATION_API_ID_PATH ?? env.VITE_MCP_PRE_REGISTRATION_API_ID_PATH) || "apiId",
      preRegistrationServiceIdPath: trimmed(env.VITE_PRE_REGISTRATION_SERVICE_ID_PATH),
      preRegistrationErrorPath: trimmed(env.VITE_PRE_REGISTRATION_ERROR_PATH),
      preRegistrationPayloadMapping: mapping,
      toolsSyncEnabled: enabled(env.VITE_TOOLS_SYNC_ENABLED),
      toolsSyncUrl: trimmed(env.VITE_TOOLS_SYNC_URL),
      toolsSyncErrorPath: trimmed(env.VITE_TOOLS_SYNC_ERROR_PATH),
      wizardRequiredApiFields: (env.VITE_WIZARD_REQUIRED_API_FIELDS ?? DEFAULT_FIELDS).split(",").map(value => value.trim()).filter(Boolean),
    },
    externalLinks,
  };
}

export function legacyBaseHref(env) {
  return (normalizedPath(env.VITE_BASE_PATH) || "") + "/";
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function portalLegacyRuntimeConfig(env, { mode }) {
  const source = () => JSON.stringify(legacyPortalConfigFromEnv(env));
  return {
    name: "portal-legacy-runtime-config",
    apply(_config, { command }) { return command === "serve" || (command === "build" && mode !== "release"); },
    configResolved(config) {
      if (enabled(env.VITE_SSO_ENABLED) && (!trimmed(env.VITE_TENANT_ID) || !trimmed(env.VITE_CLIENT_ID))) {
        const message = "VITE_SSO_ENABLED=true requires non-empty VITE_TENANT_ID and VITE_CLIENT_ID";
        config.logger.error(message);
        throw new Error(message);
      }
      const value = trimmed(env.VITE_API_BASE_URL);
      if (/^[a-z][a-z0-9+.-]*:/i.test(value) && new URL(value).origin !== "null") {
        config.logger.warn("VITE_API_BASE_URL origin is ignored; the BFF must be same-origin");
      }
    },
    transformIndexHtml(html) {
      return html.replaceAll("__PORTAL_BASE_HREF__", escapeHtml(legacyBaseHref(env)));
    },
    configureServer(server) {
      const endpoint = legacyBaseHref(env) + "portal-config.json";
      const body = source();
      server.middlewares.use((req, res, next) => {
        if ((req.method !== "GET" && req.method !== "HEAD") || req.url?.split("?", 1)[0] !== endpoint) return next();
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(req.method === "HEAD" ? undefined : body);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "portal-config.json", source: source() });
    },
  };
}
