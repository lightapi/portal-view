import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkConfigDrift, initialConfigDigest, setInitialConfigDigest } from "./digest";
import { getPortalConfig, resetPortalConfigForTests } from "./store";
import { publishTestConfig } from "../test/runtimeConfigFixture";

const fetchMock = vi.fn<typeof fetch>();
let base: HTMLBaseElement;

beforeEach(() => {
  setInitialConfigDigest("initial");
  resetPortalConfigForTests();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  base = document.createElement("base");
  base.href = "https://portal.example.test/namespace/service/portal/";
  document.head.prepend(base);
});

afterEach(() => {
  base.remove();
  setInitialConfigDigest("");
  resetPortalConfigForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("checkConfigDrift", () => {
  it("disables requests without an initial digest", async () => {
    setInitialConfigDigest("");
    expect(await checkConfigDrift()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["unchanged", { "X-Portal-Config-Digest": "initial" }, false],
    ["changed", { "X-Portal-Config-Digest": "changed" }, true],
    ["missing", {}, false],
    ["primary precedence", { "X-Portal-Config-Digest": "initial", ETag: "changed" }, false],
    ["changed primary precedence", { "X-Portal-Config-Digest": "changed", ETag: "initial" }, true],
    ["empty primary suppresses fallback", { "X-Portal-Config-Digest": "", ETag: "changed" }, false],
    ["ETag fallback", { ETag: "changed" }, true],
    ["unchanged ETag", { ETag: "initial" }, false],
    ["empty ETag", { ETag: "" }, false],
  ] as [string, Record<string, string>, boolean][])("%s", async (_, headers, expected) => {
    fetchMock.mockResolvedValue(new Response(null, { headers }));
    expect(await checkConfigDrift()).toBe(expected);
    expect(initialConfigDigest).toBe("initial");
  });

  it("returns false on network rejection", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await checkConfigDrift()).toBe(false);
    expect(initialConfigDigest).toBe("initial");
  });

  it("uses a no-store HEAD resolved against document.baseURI", async () => {
    fetchMock.mockResolvedValue(new Response(null));
    await checkConfigDrift();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL("https://portal.example.test/namespace/service/portal/portal-config.json"),
      { method: "HEAD", cache: "no-store" },
    );
  });

  it("never reads replacement configuration or replaces the initial digest or published object", async () => {
    const published = publishTestConfig();
    const response = new Response('{"replacement":true}', {
      headers: { "X-Portal-Config-Digest": "changed" },
    });
    const json = vi.spyOn(response, "json");
    const text = vi.spyOn(response, "text");
    fetchMock.mockResolvedValue(response);
    expect(await checkConfigDrift()).toBe(true);
    expect(await checkConfigDrift()).toBe(true);
    expect(initialConfigDigest).toBe("initial");
    expect(getPortalConfig()).toBe(published);
    expect(window.__PORTAL_CONFIG__).toBe(published);
    expect(Object.isFrozen(published)).toBe(true);
    expect(json).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
    expect(response.bodyUsed).toBe(false);
  });
});
