import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import oauth2 from "../contracts/portal-config/fixtures/valid/root-oauth2.json";
import entra from "../contracts/portal-config/fixtures/valid/k8s-entra.json";
import { getPortalConfig, resetPortalConfigForTests } from "./runtimeConfig/store";
import type { ReadonlyPortalRuntimeConfig } from "./runtimeConfig/types";

const fetchMock = vi.fn<typeof fetch>();
const initializeOauth = vi.fn<(cfg: ReadonlyPortalRuntimeConfig) => Promise<void>>();
const initializeEntra = vi.fn<(cfg: ReadonlyPortalRuntimeConfig) => Promise<void>>();
const renderPortal = vi.fn();
let imports: string[];
let signal: AbortSignal;
let base: HTMLBaseElement;

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  resetPortalConfigForTests();
  imports = [];
  signal = new AbortController().signal;
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
  vi.stubGlobal("fetch", fetchMock);
  initializeOauth.mockResolvedValue(undefined);
  initializeEntra.mockResolvedValue(undefined);
  // Re-register factories for every isolated module registry: the factory records
  // evaluation itself, so a missing render call cannot hide an early import.
  vi.doMock("./auth/oauth2", () => {
    imports.push("oauth2");
    return { initializeAuth: initializeOauth };
  });
  vi.doMock("./auth/entra-sso", () => {
    imports.push("entra-sso");
    return { initializeAuth: initializeEntra };
  });
  vi.doMock("./main", () => {
    imports.push("main");
    return { renderPortal };
  });
  const root = document.createElement("div");
  root.id = "root";
  root.textContent = "Previous content";
  document.body.replaceChildren(root);
  base = document.createElement("base");
  base.href = "https://portal.example.test/namespace/service/portal/";
  document.head.prepend(base);
});

afterEach(() => {
  resetPortalConfigForTests();
  base.remove();
  document.body.replaceChildren();
  vi.doUnmock("./main");
  vi.doUnmock("./auth/oauth2");
  vi.doUnmock("./auth/entra-sso");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

function response(body: string = JSON.stringify(oauth2), headers: HeadersInit = {}, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}

async function start(): Promise<void> {
  const { startPortal } = await import("./bootstrap");
  await startPortal();
}

function expectError(message: string | RegExp): void {
  const root = document.getElementById("root")!;
  expect(root.querySelector("h1")?.textContent).toBe("Portal configuration error");
  expect(root.querySelector("p")?.textContent).toMatch(message);
  expect(root.lastElementChild?.textContent).toBe("Check portal-config.json for this deployment.");
  expect(root.textContent).not.toContain("Previous content");
  expect(imports).not.toContain("main");
  expect(renderPortal).not.toHaveBeenCalled();
}

describe("bootstrap ordering", () => {
  it.each([["oauth2", oauth2], ["entra-sso", entra]] as const)(
    "%s publishes before auth, then waits for auth before importing and rendering main",
    async (mode, fixture) => {
      let finishAuth!: () => void;
      let enteredAuth!: () => void;
      const pendingAuth = new Promise<void>((resolve) => { finishAuth = resolve; });
      const entered = new Promise<void>((resolve) => { enteredAuth = resolve; });
      const selected = mode === "oauth2" ? initializeOauth : initializeEntra;
      const other = mode === "oauth2" ? initializeEntra : initializeOauth;
      selected.mockImplementation(async (cfg) => {
        expect(getPortalConfig()).toBe(cfg);
        expect(window.__PORTAL_CONFIG__).toBe(cfg);
        expect(Object.isFrozen(cfg.authentication)).toBe(true);
        enteredAuth();
        await pendingAuth;
        imports.push("auth-complete");
      });
      renderPortal.mockImplementation(() => { imports.push("render"); });
      fetchMock.mockResolvedValue(response(JSON.stringify(fixture)));
      const started = start();
      await entered;
      expect(imports).toEqual([mode]);
      expect(other).not.toHaveBeenCalled();
      expect(renderPortal).not.toHaveBeenCalled();
      finishAuth();
      await started;
      expect(imports).toEqual([mode, "auth-complete", "main", "render"]);
      expect(selected).toHaveBeenCalledExactlyOnceWith(getPortalConfig());
      expect(renderPortal).toHaveBeenCalledOnce();
    },
  );

  it("does not auto-start in test mode and uses document.baseURI and required fetch options", async () => {
    fetchMock.mockResolvedValue(response());
    const { startPortal } = await import("./bootstrap");
    expect(fetchMock).not.toHaveBeenCalled();
    await startPortal();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(new URL("portal-config.json", document.baseURI), {
      cache: "no-store", credentials: "same-origin", signal,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://portal.example.test/namespace/service/portal/portal-config.json");
    expect(AbortSignal.timeout).toHaveBeenCalledExactlyOnceWith(10_000);
  });
});

describe("configuration failures isolate application imports", () => {
  it.each([
    ["HTTP 500", () => response("failure", {}, 500), /HTTP 500/],
    ["wrong content type", () => response("<html>", { "Content-Type": "text/html" }), /Content-Type/],
    ["missing content type", () => { const r = response(); r.headers.delete("Content-Type"); return r; }, /Content-Type/],
    ["invalid JSON", () => response("{"), /JSON|property/i],
    ["invalid configuration", () => response('{"schemaVersion":2}'), /Unsupported schema version/],
    ["oversized declared length", () => response(undefined, { "Content-Length": "65537" }), /65536/],
    ["oversized text", () => response(" ".repeat(65537)), /65536/],
    // 21846 code units, 65538 UTF-8 bytes: a string-length check would accept it.
    ["oversized multi-byte body", () => response("€".repeat(21846)), /65536 byte/],
  ] as const)("%s", async (_name, makeResponse, message) => {
    const result = makeResponse();
    const read = vi.spyOn(result, "arrayBuffer");
    fetchMock.mockResolvedValue(result);
    await start();
    expectError(message);
    expect(imports).toEqual([]);
    expect(initializeOauth).not.toHaveBeenCalled();
    expect(initializeEntra).not.toHaveBeenCalled();
    expect(() => getPortalConfig()).toThrow("not loaded");
    if (_name === "oversized declared length") expect(read).not.toHaveBeenCalled();
  });

  it.each(["TimeoutError", "AbortError"])("handles %s without importing adapters or main", async (name) => {
    fetchMock.mockRejectedValue(new DOMException("Configuration request timed out or aborted", name));
    await start();
    expectError("Configuration request timed out or aborted");
    expect(imports).toEqual([]);
  });

  it("accepts exactly 65536 bytes and a matching declared length", async () => {
    fetchMock.mockResolvedValue(response(JSON.stringify(oauth2).padEnd(65536, " "), { "Content-Length": "65536" }));
    await start();
    expect(imports).toEqual(["oauth2", "main"]);
    expect(renderPortal).toHaveBeenCalledOnce();
  });

  it.each(["oauth2", "entra-sso"])("%s initialization failure prevents main import", async (mode) => {
    fetchMock.mockResolvedValue(response(JSON.stringify(mode === "oauth2" ? oauth2 : entra)));
    (mode === "oauth2" ? initializeOauth : initializeEntra).mockRejectedValue(new Error("Authentication initialization failed"));
    await start();
    expectError("Authentication initialization failed");
    expect(imports).toEqual([mode]);
  });

  it("renders untrusted error messages as text, replacing existing root contents", async () => {
    const message = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    fetchMock.mockRejectedValue(new Error(message));
    await start();
    expectError(message);
    expect(document.getElementById("root")?.querySelector("p")?.textContent).toBe(message);
    expect(document.querySelector("#root img, #root script")).toBeNull();
    expect(imports).toEqual([]);
  });
});

describe("initial configuration digest", () => {
  it.each([
    [{ "X-Portal-Config-Digest": "sha256-config", ETag: '"etag-config"' }, "sha256-config"],
    [{ ETag: '"etag-config"' }, '"etag-config"'],
    [{}, ""],
    [{ "X-Portal-Config-Digest": "", ETag: '"etag-config"' }, ""],
  ])("records header precedence for %j", async (headers, expected) => {
    const digest = await import("./runtimeConfig/digest");
    expect(digest.initialConfigDigest).toBe("");
    initializeOauth.mockImplementation(async () => {
      expect(digest.initialConfigDigest).toBe(expected);
    });
    fetchMock.mockResolvedValue(response(undefined, headers));
    await start();
    expect(digest.initialConfigDigest).toBe(expected);
    expect(renderPortal).toHaveBeenCalledOnce();
  });
});
