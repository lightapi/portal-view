import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Configuration } from "@azure/msal-browser";
import entra from "../../contracts/portal-config/fixtures/valid/k8s-entra.json";
import oauth2 from "../../contracts/portal-config/fixtures/valid/root-oauth2.json";
import { publishPortalConfig, resetPortalConfigForTests } from "../runtimeConfig/store";
import { validatePortalConfig } from "../runtimeConfig/validate";

const msal = vi.hoisted(() => ({ initialize: vi.fn<() => Promise<void>>(), constructed: vi.fn() }));
vi.mock("@azure/msal-browser", () => ({
  LogLevel: { Error: 0, Warning: 1, Info: 2, Verbose: 3 },
  PublicClientApplication: class {
    initialize = msal.initialize;
    constructor(configuration: Configuration) { msal.constructed(configuration, this); }
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  resetPortalConfigForTests();
  msal.initialize.mockResolvedValue(undefined);
});

afterEach(() => {
  resetPortalConfigForTests();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("Entra configuration", () => {
  it.each(["/", "/namespace/service/portal"])("derives both redirects under %s", async (publicBasePath) => {
    const cfg = publishPortalConfig(validatePortalConfig({ ...entra, routing: { ...entra.routing, publicBasePath } }));
    const { initializeAuth } = await import("./entra-sso");
    await initializeAuth(cfg);
    const config: Configuration = msal.constructed.mock.calls[0][0];
    const expectedPath = publicBasePath === "/" ? "/redirect" : `${publicBasePath}/redirect`;
    expect(config.auth.redirectUri).toBe(`${window.location.origin}${expectedPath}`);
    expect(config.auth.postLogoutRedirectUri).toBe(`${window.location.origin}${expectedPath}`);
    expect(new URL(String(config.auth.redirectUri)).pathname).not.toContain("//");
    expect(config.auth.clientId).toBe(entra.authentication.clientId);
    expect(config.auth.authority).toBe(`https://login.microsoftonline.com/${entra.authentication.tenantId}`);
    expect(config.auth.clientCapabilities).toEqual(["CP1"]);
  });

  it("preserves distinct explicit login and logout redirect URIs", async () => {
    const redirectUri = "https://login.example.test/custom/redirect";
    const postLogoutRedirectUri = "https://logout.example.test/signed-out";
    const cfg = publishPortalConfig(validatePortalConfig({
      ...entra, authentication: { ...entra.authentication, redirectUri, postLogoutRedirectUri },
    }));
    await (await import("./entra-sso")).initializeAuth(cfg);
    expect(msal.constructed.mock.calls[0][0].auth).toMatchObject({ redirectUri, postLogoutRedirectUri });
  });
});

describe("runtime MSAL publication", () => {
  it("constructs nothing at module load and awaits initialize before publishing", async () => {
    const cfg = publishPortalConfig(validatePortalConfig(entra));
    const holder = await import("./runtimeAuth");
    const { initializeAuth } = await import("./entra-sso");
    expect(holder.getMsalInstance()).toBeNull();
    expect(msal.constructed).not.toHaveBeenCalled();
    let finish!: () => void;
    msal.initialize.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const started = initializeAuth(cfg);
    expect(msal.constructed).toHaveBeenCalledOnce();
    expect(msal.initialize).toHaveBeenCalledOnce();
    expect(holder.getMsalInstance()).toBeNull();
    finish();
    await started;
    expect(holder.getMsalInstance()).toBe(msal.constructed.mock.calls[0][1]);
  });

  it("does not publish when MSAL initialization fails", async () => {
    const cfg = publishPortalConfig(validatePortalConfig(entra));
    const holder = await import("./runtimeAuth");
    msal.initialize.mockRejectedValue(new Error("MSAL failed"));
    await expect((await import("./entra-sso")).initializeAuth(cfg)).rejects.toThrow("MSAL failed");
    expect(holder.getMsalInstance()).toBeNull();
  });

  it("rejects the wrong mode before constructing MSAL", async () => {
    const cfg = publishPortalConfig(validatePortalConfig(oauth2));
    await expect((await import("./entra-sso")).initializeAuth(cfg)).rejects.toThrow("entra-sso configuration");
    expect(msal.constructed).not.toHaveBeenCalled();
  });

  it("the OAuth adapter clears the holder without constructing or initializing MSAL", async () => {
    const cfg = publishPortalConfig(validatePortalConfig(entra));
    await (await import("./entra-sso")).initializeAuth(cfg);
    const holder = await import("./runtimeAuth");
    expect(holder.getMsalInstance()).not.toBeNull();
    msal.constructed.mockClear();
    msal.initialize.mockClear();
    await (await import("./oauth2")).initializeAuth(validatePortalConfig(oauth2));
    expect(holder.getMsalInstance()).toBeNull();
    expect(msal.constructed).not.toHaveBeenCalled();
    expect(msal.initialize).not.toHaveBeenCalled();
  });
});
