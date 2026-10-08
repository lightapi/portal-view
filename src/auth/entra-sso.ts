import { PublicClientApplication } from "@azure/msal-browser";
import { buildMsalConfig } from "../authConfig.js";
import type { ReadonlyPortalRuntimeConfig } from "../runtimeConfig/types";
import { setMsalInstance } from "./runtimeAuth";

export async function initializeAuth(cfg: ReadonlyPortalRuntimeConfig): Promise<void> {
  if (cfg.authentication.mode !== "entra-sso") {
    throw new Error("Entra authentication requires entra-sso configuration");
  }
  const instance = new PublicClientApplication(buildMsalConfig(cfg.authentication));
  await instance.initialize();
  setMsalInstance(instance);
}
