import type { IPublicClientApplication } from "@azure/msal-browser";
import { config, isSsoEnabled } from "../../config";
import { loginRequest } from "../authConfig";

/**
 * Send the person to sign in to Portal, the way this deployment does it: the MSAL redirect when SSO
 * is enabled (which needs the MSAL instance), otherwise the standard sign-in service. One place, so
 * the header menu and any page that asks the person to sign in cannot drift apart.
 */
export async function signIn(msalInstance?: IPublicClientApplication): Promise<void> {
  if (isSsoEnabled) {
    if (!msalInstance) {
      console.error("MSAL instance unavailable while SSO is enabled");
      return;
    }

    const normalizedBasePath =
      config.basePath && config.basePath !== "/" ? config.basePath.replace(/\/$/, "") : "";
    const msalRedirectUri = config.redirectUri || `${window.location.origin}${normalizedBasePath}/redirect`;

    try {
      await msalInstance.loginRedirect({
        ...loginRequest,
        redirectUri: msalRedirectUri,
      });
    } catch (error) {
      console.error("Login error:", error);
    }
    return;
  }

  // Generate a random state for CSRF protection
  const state = Math.random().toString(36).substring(7);
  localStorage.setItem("portal_auth_state", state);

  const defaultUrl = `https://signin.localhost?client_id=f7d42348-c647-4efb-a52d-4c5787421e72&user_type=E&state=${state}`;
  window.location.href = config.signInUrl ? `${config.signInUrl}&user_type=E&state=${state}` : defaultUrl;
}
