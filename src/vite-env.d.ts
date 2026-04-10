/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PORT?: string;
    readonly VITE_BASE_PATH?: string;
    readonly VITE_SIGNIN_URL?: string;
    readonly VITE_API_BASE_URL?: string;
    readonly VITE_SSO_ENABLED?: string;
    readonly VITE_CLIENT_ID?: string;
    readonly VITE_TENANT_ID?: string;
    readonly VITE_REDIRECT_URI?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
