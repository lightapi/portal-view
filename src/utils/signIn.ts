import type { IPublicClientApplication } from "@azure/msal-browser";
import { getPortalConfig } from "../../config";
import { browserRedirectUri } from "./runtimePaths";
import { loginRequest } from "../authConfig";

/**
 * Send the person to sign in to Portal, the way this deployment does it: the MSAL redirect when SSO
 * is enabled (which needs the MSAL instance), otherwise the standard sign-in service. One place, so
 * the header menu and any page that asks the person to sign in cannot drift apart.
 */
export async function signIn(msalInstance?: IPublicClientApplication): Promise<void> {
  const auth = getPortalConfig().authentication;
  if (auth.mode === "entra-sso") {
    if (!msalInstance) {
      console.error("MSAL instance unavailable while SSO is enabled");
      return;
    }

    try {
      await msalInstance.loginRedirect({
        ...loginRequest,
        redirectUri: browserRedirectUri(auth.redirectUri),
      });
    } catch (error) {
      console.error("Login error:", error);
    }
    return;
  }

  // Generate a random state for CSRF protection
  const state = crypto.randomUUID();
  localStorage.setItem("portal_auth_state", state);

  const url = new URL(auth.signInUrl, window.location.origin);
  url.searchParams.set("user_type", "E");
  url.searchParams.set("state", state);
  window.location.href = url.toString();
}
