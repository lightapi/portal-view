type AppConfig = {
    basePath: string;
    signInUrl: string;
    apiBaseUrl: string;
    ssoEnabled: string;
    preRegistrationEnabled: string;
    preRegistrationUrl: string;
    preRegistrationApiIdPath: string;
    preRegistrationServiceIdPath: string;
    preRegistrationErrorPath: string;
    preRegistrationPayloadMapping: string;
    toolsSyncEnabled: string;
    toolsSyncUrl: string;
    toolsSyncErrorPath: string;
    wizardRequiredApiFields: string;
    clientId: string;
    tenantId: string;
    redirectUri: string;
    apiOnboardUrl: string;
    productReleaseUrl: string;
    portalDocBaseUrl: string;
}

export const config: AppConfig = {
    basePath: import.meta.env.VITE_BASE_PATH ?? "/",
    signInUrl: import.meta.env.VITE_SIGNIN_URL ?? "",
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
    ssoEnabled: import.meta.env.VITE_SSO_ENABLED ?? "false",
    preRegistrationEnabled: import.meta.env.VITE_PRE_REGISTRATION_ENABLED ?? import.meta.env.VITE_MCP_PRE_REGISTRATION_ENABLED ?? "false",
    preRegistrationUrl: import.meta.env.VITE_PRE_REGISTRATION_URL ?? import.meta.env.VITE_MCP_PRE_REGISTRATION_URL ?? "",
    preRegistrationApiIdPath: import.meta.env.VITE_PRE_REGISTRATION_API_ID_PATH ?? import.meta.env.VITE_MCP_PRE_REGISTRATION_API_ID_PATH ?? "apiId",
    preRegistrationServiceIdPath: import.meta.env.VITE_PRE_REGISTRATION_SERVICE_ID_PATH ?? "",
    preRegistrationErrorPath: import.meta.env.VITE_PRE_REGISTRATION_ERROR_PATH ?? "",
    preRegistrationPayloadMapping: import.meta.env.VITE_PRE_REGISTRATION_PAYLOAD_MAPPING ?? "",
    toolsSyncEnabled: import.meta.env.VITE_TOOLS_SYNC_ENABLED ?? "false",
    toolsSyncUrl: import.meta.env.VITE_TOOLS_SYNC_URL ?? "",
    toolsSyncErrorPath: import.meta.env.VITE_TOOLS_SYNC_ERROR_PATH ?? "",
    wizardRequiredApiFields: import.meta.env.VITE_WIZARD_REQUIRED_API_FIELDS ?? "categoryIds,apiDesc,region,businessGroup,lob,platform",
    clientId: import.meta.env.VITE_CLIENT_ID ?? "",
    tenantId: import.meta.env.VITE_TENANT_ID ?? "",
    redirectUri: import.meta.env.VITE_REDIRECT_URI ?? "",
    apiOnboardUrl: import.meta.env.VITE_API_ONBOARD_URL ?? 'https://lightapi.net',
    productReleaseUrl: import.meta.env.VITE_PRODUCT_RELEASE_URL ?? 'https://lightapi.net/releases',
    portalDocBaseUrl: import.meta.env.VITE_PORTAL_DOC_BASE_URL ?? 'https://doc.lightapi.net',
}

export const isSsoEnabled = config.ssoEnabled.toLowerCase() === "true";
export const isPreRegistrationEnabled = config.preRegistrationEnabled.toLowerCase() === "true";
export const preRegistrationUrl = config.preRegistrationUrl.trim();
export const preRegistrationApiIdPath = config.preRegistrationApiIdPath.trim() || "apiId";
export const preRegistrationServiceIdPath = config.preRegistrationServiceIdPath.trim();
export const preRegistrationErrorPath = config.preRegistrationErrorPath.trim();
export const isToolsSyncEnabled = config.toolsSyncEnabled.toLowerCase() === 'true';
export const toolsSyncUrl = config.toolsSyncUrl.trim();
export const toolsSyncErrorPath = config.toolsSyncErrorPath.trim();
export const preRegistrationPayloadMapping: Record<string, string> = (() => {
    const raw = config.preRegistrationPayloadMapping.trim();
    if (!raw) return {};
    try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
})();

export const wizardRequiredApiFields: string[] = config.wizardRequiredApiFields
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
