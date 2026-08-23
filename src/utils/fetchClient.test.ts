import { beforeEach, describe, expect, it, vi } from "vitest";
import fetchClient from "./fetchClient";

vi.mock("universal-cookie", () => ({
  default: class MockCookies {
    get(name: string) {
      return name === "csrf" ? "csrf-token" : undefined;
    }
  },
}));

describe("fetchClient", () => {
  const responseJson = vi.fn();
  const fetchMock = vi.fn();

  beforeEach(() => {
    responseJson.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("returns from a successful 204 without attempting JSON parsing", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      json: responseJson,
    });

    await expect(fetchClient("/logout", { method: "POST" })).resolves.toEqual({});

    expect(responseJson).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/logout$/),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({ "X-CSRF-TOKEN": "csrf-token" }),
      }),
    );
  });

  it("continues parsing JSON for a successful non-204 response", async () => {
    responseJson.mockResolvedValue({ message: "ok" });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: responseJson,
    });

    await expect(fetchClient("/api/status")).resolves.toEqual({ message: "ok" });

    expect(responseJson).toHaveBeenCalledOnce();
  });

  it("preserves a plain-text error response with its HTTP status", async () => {
    fetchMock.mockResolvedValue(new Response(
      "Access denied: no access control rule defined for lightapi.net/genai/getKnowledgeBases/0.1.0",
      { status: 403, statusText: "Forbidden" },
    ));

    await expect(fetchClient("/portal/query?cmd=test")).rejects.toBe(
      "HTTP 403 Forbidden: Access denied: no access control rule defined for lightapi.net/genai/getKnowledgeBases/0.1.0",
    );
  });

  it("preserves a structured JSON error response", async () => {
    const error = { code: "AUTH_TOKEN_SCOPE_MISMATCH", description: "portal.knowledge.r is required" };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(error), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(fetchClient("/portal/query?cmd=test")).rejects.toEqual(error);
  });
});
