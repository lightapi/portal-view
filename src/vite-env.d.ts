/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PORTAL_URL: string;
    readonly VITE_PORT?: string;
    readonly VITE_HTTPS_ENABLED?: string;
    readonly VITE_HTTPS_KEY_PATH?: string;
    readonly VITE_HTTPS_CERT_PATH?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
