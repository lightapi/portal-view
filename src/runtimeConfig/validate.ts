import { SUPPORTED_SCHEMA_VERSIONS } from "./types";
import type { AuthenticationConfig, PortalRuntimeConfig } from "./types";

export class PortalConfigError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "PortalConfigError";
  }
}

const FEATURE_DEFAULTS: PortalRuntimeConfig["features"] = {
  preRegistrationEnabled: false,
  preRegistrationUrl: "",
  preRegistrationApiIdPath: "apiId",
  preRegistrationServiceIdPath: "",
  preRegistrationErrorPath: "",
  preRegistrationPayloadMapping: {},
  toolsSyncEnabled: false,
  toolsSyncUrl: "",
  toolsSyncErrorPath: "",
  wizardRequiredApiFields: ["categoryIds", "apiDesc", "region", "businessGroup", "lob", "platform"],
};
const LINK_DEFAULTS: PortalRuntimeConfig["externalLinks"] = {
  portalDocumentation: "https://doc.lightapi.net",
  apiOnboarding: "https://lightapi.net",
  productReleases: "https://lightapi.net/releases",
};
const SECRET_FIELD = /secret|password|private|token|bearer|credential/i;
const PATH = /^(\/[A-Za-z0-9._~!$&'()*+,;=:@-]+)+$/;
const FEATURE_PATH = /^(\/[A-Za-z0-9._~!$&'()*+,;=:@{}-]+)+$/;
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function fail(field: string, message: string): never {
  throw new PortalConfigError(field, message);
}

function object(value: unknown, field: string, keys?: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(field, "Must be a plain object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(field, "Must be a plain object");
  const record = value as Record<string, unknown>;
  // Mapping keys are data: only schema objects supply an allowlist here.
  if (keys) {
    for (const key of Object.keys(record)) {
      const location = field === "$" ? key : `${field}.${key}`;
      if (SECRET_FIELD.test(key)) fail(location, "Secret-shaped configuration fields are forbidden");
      if (!keys.includes(key)) fail(location, "Unknown configuration field");
    }
  }
  return record;
}

function string(value: unknown, field: string, max = 2048): string {
  if (typeof value !== "string") fail(field, "Must be a string");
  // JSON Schema maxLength counts Unicode code points, not UTF-16 code units.
  if (Array.from(value).length > max) fail(field, `Must contain at most ${max} characters`);
  return value;
}

function defaulted(record: Record<string, unknown>, key: string, fallback: unknown): unknown {
  return Object.hasOwn(record, key) ? record[key] : fallback;
}

function path(value: unknown, field: string, allowRoot: boolean, allowEmpty: boolean): string {
  const result = string(value, field, 256);
  if ((allowRoot && result === "/") || (allowEmpty && result === "")) return result;
  if (PATH.exec(result)?.[0] !== result || result.split("/").some((segment) => segment === "." || segment === "..")) {
    fail(field, "Must be a canonical root-absolute path without trailing slash or dot segments");
  }
  return result;
}

// Rules 6.1–6.4 MUST run on the original text, before WHATWG URL normalization.
function strictUrl(value: string, field: string, allowRelative: boolean, allowHttp = false): URL {
  const beforeQuery = value.split("?", 1)[0];
  if (/[\\\s#]/.test(value) || Array.from(value).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
      || beforeQuery.includes("@")) {
    fail(field, "URL must not contain backslashes, whitespace, controls, fragments, or userinfo");
  }
  if (/%(?:2f|5c|2e)/i.test(beforeQuery) || /%(?![0-9a-fA-F]{2})/.test(value)) {
    fail(field, "URL contains an unsafe path encoding or malformed percent escape");
  }
  const relative = /^\/(?![/\\])[^?]*(\?.*)?$/.test(value);
  const absolute = /^(https?):\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?(\/[^?]*)?(\?.*)?$/.exec(value);
  if (!(allowRelative && relative) && !(absolute && (absolute[1] === "https" || allowHttp))) {
    fail(field, "Must be an allowed root-relative or absolute HTTPS URL");
  }
  const rawPath = relative ? beforeQuery : beforeQuery.replace(/^https?:\/\/[^/]+/, "");
  if (rawPath.split("/").some((segment) => segment === "." || segment === "..")) {
    fail(field, "URL path must not contain dot segments");
  }
  let parsed: URL;
  try {
    parsed = new URL(value, "https://placeholder.invalid");
  } catch {
    fail(field, "Must be a valid URL");
  }
  if (relative && parsed.host !== "placeholder.invalid") fail(field, "Relative URL must remain same-origin");
  if (parsed.protocol === "http:" && parsed.hostname !== "localhost" && !parsed.hostname.endsWith(".localhost")) {
    fail(field, "HTTP is allowed only for localhost or a .localhost host");
  }
  return parsed;
}

function uuid(value: unknown, field: string): string {
  const result = string(value, field);
  if (UUID.exec(result)?.[0] !== result) fail(field, "Must use the UUID 8-4-4-4-12 hexadecimal layout");
  if (/^(.)\1{31}$/i.test(result.replaceAll("-", ""))) fail(field, "Placeholder UUIDs are forbidden");
  return result;
}

function authentication(value: unknown): AuthenticationConfig {
  const field = "authentication";
  const record = object(value, field);
  const mode = record.mode;
  if (mode !== "oauth2" && mode !== "entra-sso") fail(`${field}.mode`, "Must be oauth2 or entra-sso");
  object(record, field, mode === "oauth2" ? ["mode", "signInUrl"]
    : ["mode", "tenantId", "clientId", "redirectUri", "postLogoutRedirectUri"]);
  if (mode === "oauth2") {
    const location = `${field}.signInUrl`;
    const signInUrl = string(record.signInUrl, location);
    if (!signInUrl) fail(location, "A non-empty sign-in URL is required");
    const parsed = strictUrl(signInUrl, location, true);
    if (parsed.searchParams.has("state") || parsed.searchParams.has("user_type")) {
      fail(location, "state and user_type are generated per login and must not be configured");
    }
    const clients = parsed.searchParams.getAll("client_id");
    if (clients.length !== 1 || clients[0].length === 0) fail(location, "Exactly one non-empty client_id is required");
    return { mode, signInUrl };
  }
  const result: AuthenticationConfig = {
    mode,
    tenantId: uuid(record.tenantId, `${field}.tenantId`),
    clientId: uuid(record.clientId, `${field}.clientId`),
  };
  for (const key of ["redirectUri", "postLogoutRedirectUri"] as const) {
    if (Object.hasOwn(record, key)) {
      const redirect = string(record[key], `${field}.${key}`);
      if (redirect) {
        strictUrl(redirect, `${field}.${key}`, false, true);
        if (redirect.includes("?")) fail(`${field}.${key}`, "Redirect URL must not contain a query");
      }
      result[key] = redirect;
    }
  }
  return result;
}

function featureUrl(value: unknown, field: string): string {
  const result = string(value, field);
  if (result === "") return result;
  if (result.startsWith("/")) {
    // Root-relative BFF endpoints keep canonical segments (joinApiPath drops empty
    // ones) but may carry {apiId}/{version} templates and a query.
    const rawPath = result.split("?", 1)[0];
    if (rawPath !== "/" && (FEATURE_PATH.exec(rawPath)?.[0] !== rawPath
        || rawPath.split("/").some((segment) => segment === "." || segment === ".."))) {
      fail(field, "Must be a canonical root-relative endpoint without trailing slash or dot segments");
    }
    strictUrl(result, field, true);
    return result;
  }
  strictUrl(result, field, false);
  return result;
}

function features(value: unknown): PortalRuntimeConfig["features"] {
  const record = object(value, "features", Object.keys(FEATURE_DEFAULTS));
  const result = { ...FEATURE_DEFAULTS };
  for (const key of ["preRegistrationEnabled", "toolsSyncEnabled"] as const) {
    const candidate = defaulted(record, key, FEATURE_DEFAULTS[key]);
    if (typeof candidate !== "boolean") fail(`features.${key}`, "Must be a boolean");
    result[key] = candidate;
  }
  for (const key of ["preRegistrationUrl", "toolsSyncUrl"] as const) {
    result[key] = featureUrl(defaulted(record, key, FEATURE_DEFAULTS[key]), `features.${key}`);
  }
  for (const key of ["preRegistrationApiIdPath", "preRegistrationServiceIdPath", "preRegistrationErrorPath", "toolsSyncErrorPath"] as const) {
    result[key] = string(defaulted(record, key, FEATURE_DEFAULTS[key]), `features.${key}`);
  }
  const mappingField = "features.preRegistrationPayloadMapping";
  const mapping = object(defaulted(record, "preRegistrationPayloadMapping", {}), mappingField);
  if (Object.keys(mapping).length > 64) fail(mappingField, "Must contain at most 64 entries");
  result.preRegistrationPayloadMapping = Object.fromEntries(Object.entries(mapping).map(([key, value]) => {
    const location = `${mappingField}.${key}`;
    string(key, location);
    const mapped = string(value, location);
    if (/secret|password|token/i.test(mapped)) fail(location, "Mapping values must not contain secret, password, or token");
    return [key, mapped];
  }));
  const fieldsLocation = "features.wizardRequiredApiFields";
  const fields = defaulted(record, "wizardRequiredApiFields", FEATURE_DEFAULTS.wizardRequiredApiFields);
  if (!Array.isArray(fields)) fail(fieldsLocation, "Must be an array");
  if (fields.length > 32) fail(fieldsLocation, "Must contain at most 32 items");
  result.wizardRequiredApiFields = Array.from(fields, (value, index) => string(value, `${fieldsLocation}[${index}]`, 64));
  return result;
}

function externalLinks(value: unknown): PortalRuntimeConfig["externalLinks"] {
  const record = object(value, "externalLinks", Object.keys(LINK_DEFAULTS));
  const result = { ...LINK_DEFAULTS };
  for (const key of Object.keys(LINK_DEFAULTS) as (keyof typeof LINK_DEFAULTS)[]) {
    const field = `externalLinks.${key}`;
    const link = string(defaulted(record, key, LINK_DEFAULTS[key]), field);
    let parsed: URL;
    try {
      parsed = new URL(link);
    } catch {
      fail(field, "Must be an absolute HTTPS URL");
    }
    if (!/^https:\/\//i.test(link) || parsed.protocol !== "https:") fail(field, "Must be an absolute HTTPS URL");
    result[key] = link;
  }
  return result;
}

/** Validate and copy JSON configuration. The caller enforces the 64 KiB document limit (WP3). */
export function validatePortalConfig(candidate: unknown): PortalRuntimeConfig {
  const record = object(candidate, "$", ["schemaVersion", "routing", "authentication", "features", "externalLinks"]);
  if (!SUPPORTED_SCHEMA_VERSIONS.some((version) => version === record.schemaVersion)) {
    fail("schemaVersion", "Unsupported schema version");
  }
  const routing = object(record.routing, "routing", ["publicBasePath", "apiBasePath"]);
  return {
    schemaVersion: 1,
    routing: {
      publicBasePath: path(routing.publicBasePath, "routing.publicBasePath", true, false),
      apiBasePath: path(routing.apiBasePath, "routing.apiBasePath", false, true),
    },
    authentication: authentication(record.authentication),
    features: features(record.features),
    externalLinks: externalLinks(record.externalLinks),
  };
}
