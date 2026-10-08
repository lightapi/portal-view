import { getPortalConfig } from "./src/runtimeConfig/store";

export { getPortalConfig };
export const isSsoEnabled = () => getPortalConfig().authentication.mode === "entra-sso";
export const isPreRegistrationEnabled = () => getPortalConfig().features.preRegistrationEnabled;
export const preRegistrationUrl = () => getPortalConfig().features.preRegistrationUrl;
export const preRegistrationApiIdPath = () => getPortalConfig().features.preRegistrationApiIdPath;
export const preRegistrationServiceIdPath = () => getPortalConfig().features.preRegistrationServiceIdPath;
export const preRegistrationErrorPath = () => getPortalConfig().features.preRegistrationErrorPath;
export const preRegistrationPayloadMapping = () => getPortalConfig().features.preRegistrationPayloadMapping;
export const isToolsSyncEnabled = () => getPortalConfig().features.toolsSyncEnabled;
export const toolsSyncUrl = () => getPortalConfig().features.toolsSyncUrl;
export const toolsSyncErrorPath = () => getPortalConfig().features.toolsSyncErrorPath;
export const wizardRequiredApiFields = () => getPortalConfig().features.wizardRequiredApiFields;
export const publicBasePath = () => getPortalConfig().routing.publicBasePath;
export const externalLinks = () => getPortalConfig().externalLinks;
