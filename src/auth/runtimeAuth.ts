import type { PublicClientApplication } from "@azure/msal-browser";

let msalInstance: PublicClientApplication | null = null;

export function setMsalInstance(instance: PublicClientApplication | null): void {
  msalInstance = instance;
}

export function getMsalInstance(): PublicClientApplication | null {
  return msalInstance;
}
