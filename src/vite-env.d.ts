/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PORTAL_URL: string;
    readonly VITE_PORT?: string;
    readonly VITE_HTTPS_ENABLED?: string;
    readonly VITE_HTTPS_KEY_PATH?: string;
    readonly VITE_HTTPS_CERT_PATH?: string;
    readonly VITE_BASE_PATH?: string;
    readonly VITE_SIGNIN_URL?: string;
    readonly VITE_API_BASE_URL?: string;
    readonly VITE_SSO_ENABLED?: string;
    readonly VITE_CLIENT_ID?: string;
    readonly VITE_TENANT_ID?: string;
    readonly VITE_REDIRECT_URI?: string;
    readonly VITE_API_ONBOARD_URL?: string;
    readonly VITE_PRODUCT_RELEASE_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
