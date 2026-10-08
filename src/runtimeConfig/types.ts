export type AuthenticationConfig =
  | { mode: "oauth2"; signInUrl: string }
  | {
      mode: "entra-sso";
      tenantId: string;
      clientId: string;
      redirectUri?: string;
      postLogoutRedirectUri?: string;
    };

export interface PortalRuntimeConfig {
  schemaVersion: 1;
  routing: { publicBasePath: string; apiBasePath: string };
  authentication: AuthenticationConfig;
  features: {
    preRegistrationEnabled: boolean;
    preRegistrationUrl: string;
    preRegistrationApiIdPath: string;
    preRegistrationServiceIdPath: string;
    preRegistrationErrorPath: string;
    preRegistrationPayloadMapping: Record<string, string>;
    toolsSyncEnabled: boolean;
    toolsSyncUrl: string;
    toolsSyncErrorPath: string;
    wizardRequiredApiFields: string[];
  };
  externalLinks: {
    portalDocumentation: string;
    apiOnboarding: string;
    productReleases: string;
  };
}

export type DeepReadonly<T> = T extends (infer U)[]
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

export type ReadonlyPortalRuntimeConfig = DeepReadonly<PortalRuntimeConfig>;
export const SUPPORTED_SCHEMA_VERSIONS = [1] as const;
