import type { DeepReadonly, PortalRuntimeConfig, ReadonlyPortalRuntimeConfig } from "./types";

declare global {
  interface Window {
    __PORTAL_CONFIG__?: ReadonlyPortalRuntimeConfig;
  }
}

/** Recursively freeze the validated JSON configuration, preserving its identity. */
export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export function publishPortalConfig(cfg: PortalRuntimeConfig): ReadonlyPortalRuntimeConfig {
  if (window.__PORTAL_CONFIG__ !== undefined) {
    throw new Error("Portal runtime configuration is already loaded");
  }
  const frozen = deepFreeze(cfg);
  window.__PORTAL_CONFIG__ = frozen;
  return frozen;
}

export function getPortalConfig(): ReadonlyPortalRuntimeConfig {
  if (window.__PORTAL_CONFIG__ === undefined) {
    throw new Error("Portal runtime configuration is not loaded");
  }
  return window.__PORTAL_CONFIG__;
}

export function resetPortalConfigForTests(): void {
  delete window.__PORTAL_CONFIG__;
}
