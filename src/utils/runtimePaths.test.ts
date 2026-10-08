import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../contracts/portal-config/fixtures/valid/root-oauth2.json";
import { publishPortalConfig, resetPortalConfigForTests } from "../runtimeConfig/store";
import { validatePortalConfig } from "../runtimeConfig/validate";
import { apiUrl, apiWebSocketUrl, browserRedirectUri, joinApiPath, joinBrowserPath } from "./runtimePaths";

const realLocation = window.location;

function configure(origin: string, apiBasePath = "", publicBasePath = "/"): void {
  Object.defineProperty(window, "location", { configurable: true, value: { origin } });
  publishPortalConfig(validatePortalConfig({ ...fixture, routing: { apiBasePath, publicBasePath } }));
}

beforeEach(resetPortalConfigForTests);
afterEach(() => {
  resetPortalConfigForTests();
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
  vi.restoreAllMocks();
});

describe("path joining", () => {
  it.each([
    ["/namespace-dev/service", "/portal/query", "/namespace-dev/service/portal/query"],
    ["", "/portal/query", "/portal/query"],
    ["", "/portal/query?cmd=%7B%7D", "/portal/query?cmd=%7B%7D"],
    ["/a//", "/x///y/", "/a/x/y"],
    ["", "/", "/"],
    ["/a/", "/x?", "/a/x?"],
    ["/a", "/x?z=2&z=1&v=+%20%2f&next=/../x??&empty=", "/a/x?z=2&z=1&v=+%20%2f&next=/../x??&empty="],
  ])("joinApiPath(%s, %s)", (base, endpoint, expected) => {
    expect(joinApiPath(base, endpoint)).toBe(expected);
  });

  it.each([
    ["/a/", "//x"], ["/a", "/../x"], ["/a", "/./x"],
    ["/./a", "/x"], ["/a/..", "/x"], ["/a", "x"], ["", ""],
    ["", "http://evil.example/x"], ["", "https://evil.example/x"],
  ])("rejects API path (%s, %s)", (base, endpoint) => {
    expect(() => joinApiPath(base, endpoint)).toThrow();
  });

  it.each([
    ["/", "/redirect", "/redirect"],
    ["/namespace-dev/service/ai/portal", "/redirect", "/namespace-dev/service/ai/portal/redirect"],
    ["/p", "redirect", "/p/redirect"],
    ["//p///", "//a///b/", "/p/a/b"],
    ["", "", "/"], ["/", "/", "/"], ["/p", "/.well-known/...", "/p/.well-known/..."],
  ])("joinBrowserPath(%s, %s)", (base, path, expected) => {
    expect(joinBrowserPath(base, path)).toBe(expected);
  });

  it.each([["/p", "/./x"], ["/p", "../x"], ["/../p", "x"], ["/p/.", "x"]])(
    "rejects browser dot segments (%s, %s)", (base, path) => expect(() => joinBrowserPath(base, path)).toThrow(),
  );
});

describe("runtime URLs", () => {
  it.each([
    ["https://h", "", "https://h/portal/query"],
    ["http://h", "/api", "http://h/api/portal/query"],
    ["https://h", "/namespace-dev/service", "https://h/namespace-dev/service/portal/query"],
  ])("resolves API paths against %s with API base %s", (origin, apiBasePath, expected) => {
    configure(origin, apiBasePath, "/different/browser/base");
    expect(apiUrl("/portal/query")).toBe(expected);
  });

  it("preserves query order, duplicates, escapes, slashes, and additional question marks", () => {
    configure("https://h", "/x");
    const query = "?z=2&z=1&cmd=%7B%7D&v=+%20%2f&next=/../x??&empty=";
    expect(apiUrl("/portal/query" + query)).toBe("https://h/x/portal/query" + query);
    expect(apiWebSocketUrl("/chat" + query)).toBe("wss://h/x/chat" + query);
  });

  it.each(["http://evil.example/x", "https://evil.example/x", "https:evil.example/x", "//evil.example/x"])(
    "rejects BFF origin override %s", (endpoint) => {
      configure("https://h");
      expect(() => apiUrl(endpoint)).toThrow();
      expect(() => apiWebSocketUrl(endpoint)).toThrow();
    },
  );

  it.each([
    ["https://h", "/x", "wss://h/x/chat"], ["http://h", "/x", "ws://h/x/chat"],
    ["https://h", "", "wss://h/chat"], ["http://h", "", "ws://h/chat"],
  ])("maps WebSocket protocol at %s with API base %s", (origin, base, expected) => {
    configure(origin, base, "/browser");
    expect(apiWebSocketUrl("/chat")).toBe(expected);
  });

  it.each([
    ["/", "", "https://h/redirect"], ["/", undefined, "https://h/redirect"],
    ["/namespace-dev/service/ai/portal", "", "https://h/namespace-dev/service/ai/portal/redirect"],
    ["/p", undefined, "https://h/p/redirect"],
  ])("derives redirect with browser base %s and explicit %s", (base, explicit, expected) => {
    configure("https://h", "/different/api/base", base);
    expect(browserRedirectUri(explicit)).toBe(expected);
  });

  it.each(["https://other.example/a%2fb?b=2&a=1", "/explicit", " "])(
    "returns non-empty explicit redirect unchanged without needing publication: %s", (explicit) => {
      expect(browserRedirectUri(explicit)).toBe(explicit);
    },
  );

  it("requires publication for derived URLs", () => {
    for (const call of [() => apiUrl("/x"), () => apiWebSocketUrl("/x"), () => browserRedirectUri()]) {
      expect(call).toThrowError(new Error("Portal runtime configuration is not loaded"));
    }
  });
});
