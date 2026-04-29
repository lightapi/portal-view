type AppConfig = {
    basePath: string;
    signInUrl: string;
    apiBaseUrl: string;
    ssoEnabled: string;
    clientId: string;
    tenantId: string;
    redirectUri: string;
    apiOnboardUrl: string;
    productReleaseUrl: string;
}

export const config: AppConfig = {
    basePath: import.meta.env.VITE_BASE_PATH ?? "/",
    signInUrl: import.meta.env.VITE_SIGNIN_URL ?? "",
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
    ssoEnabled: import.meta.env.VITE_SSO_ENABLED ?? "false",
    clientId: import.meta.env.VITE_CLIENT_ID ?? "",
    tenantId: import.meta.env.VITE_TENANT_ID ?? "",
    redirectUri: import.meta.env.VITE_REDIRECT_URI ?? "",
    apiOnboardUrl: import.meta.env.VITE_API_ONBOARD_URL ?? 'https://lightapi.net',
    productReleaseUrl: import.meta.env.VITE_PRODUCT_RELEASE_URL ?? 'https://lightapi.net/releases',
}

export const isSsoEnabled = config.ssoEnabled.toLowerCase() === "true";