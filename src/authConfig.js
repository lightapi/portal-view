/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { LogLevel } from "@azure/msal-browser";

import { config, isSsoEnabled } from "../config";

const clientId =
    typeof config.clientId === "string" ? config.clientId.trim() : "";
const tenantId =
    typeof config.tenantId === "string" ? config.tenantId.trim() : "";
const redirectUri =
    typeof config.redirectUri === "string" ? config.redirectUri.trim() : "";

if (isSsoEnabled && !clientId) {
    throw new Error(
        "Missing required MSAL configuration: VITE_CLIENT_ID must be a non-empty string when SSO is enabled.",
    );
}

if (isSsoEnabled && !tenantId) {
    throw new Error(
        "Missing required MSAL configuration: VITE_TENANT_ID must be a non-empty string when SSO is enabled.",
    );
}

const authConfig = {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    ...(redirectUri ? { redirectUri } : {}),
    postLogoutRedirectUri: "/redirect",
    clientCapabilities: ["CP1"],
};

/**
 * Configuration object to be passed to MSAL instance on creation.
 * For a full list of MSAL.js configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/configuration.md
 */
export const msalConfig = {
    auth: authConfig,
    cache: {
        cacheLocation: "localStorage", // Configures cache location. "sessionStorage" is more secure, but "localStorage" gives you SSO between tabs.
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    },
    system: {
        loggerOptions: {
            /**
             * Below you can configure MSAL.js logs. For more information, visit:
             * https://docs.microsoft.com/azure/active-directory/develop/msal-logging-js
             */
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) {
                    return;
                }
                switch (level) {
                    case LogLevel.Error:
                        console.error(message);
                        return;
                    case LogLevel.Info:
                        //console.info(message);
                        return;
                    case LogLevel.Verbose:
                        //console.debug(message);
                        return;
                    case LogLevel.Warning:
                        console.warn(message);
                        return;
                    default:
                        return;
                }
            }
        }
    }
};

/**
 * Add here the endpoints and scopes when obtaining an access token for protected web APIs. For more information, see:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/resources-and-scopes.md
 */
export const protectedResources = {
}

/**
 * Scopes you add here will be prompted for user consent during sign-in.
 * By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
 * For more information about OIDC scopes, visit:
 * https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
 */
export const loginRequest = {
    scopes: []
};
