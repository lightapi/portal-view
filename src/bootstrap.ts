import { renderConfigurationError } from "./bootstrapErrorPage";
import { setInitialConfigDigest } from "./runtimeConfig/digest";
import { publishPortalConfig } from "./runtimeConfig/store";
import { validatePortalConfig } from "./runtimeConfig/validate";

export async function startPortal(): Promise<void> {
  try {
    const url = new URL("portal-config.json", document.baseURI);
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Portal configuration failed: HTTP ${response.status}`);
    }
    if (!response.headers.get("Content-Type")?.startsWith("application/json")) {
      throw new Error("Portal configuration must have Content-Type application/json");
    }
    const contentLength = response.headers.get("Content-Length");
    if (contentLength !== null && Number(contentLength) > 65536) {
      throw new Error("Portal configuration exceeds the 65536 byte limit");
    }
    // Measure bytes before decoding: string length counts UTF-16 code units.
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 65536) {
      throw new Error("Portal configuration exceeds the 65536 byte limit");
    }
    const candidate: unknown = JSON.parse(new TextDecoder().decode(bytes));
    const cfg = publishPortalConfig(validatePortalConfig(candidate));
    setInitialConfigDigest(response.headers.get("X-Portal-Config-Digest") ??
      response.headers.get("ETag") ?? "");

    const adapter = cfg.authentication.mode === "entra-sso"
      ? await import("./auth/entra-sso") : await import("./auth/oauth2");
    await adapter.initializeAuth(cfg);
    const { renderPortal } = await import("./main");
    renderPortal();
  } catch (error) {
    renderConfigurationError(error);
  }
}

if (import.meta.env.MODE !== "test") void startPortal();
