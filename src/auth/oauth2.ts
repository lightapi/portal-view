import type { ReadonlyPortalRuntimeConfig } from "../runtimeConfig/types";
import { setMsalInstance } from "./runtimeAuth";

export async function initializeAuth(_cfg: ReadonlyPortalRuntimeConfig): Promise<void> {
  setMsalInstance(null);
}
