import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fetchClient from "./fetchClient";
import { publishTestConfig } from "../test/runtimeConfigFixture";

const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));

vi.mock("universal-cookie", () => ({
  default: class MockCookies {
    get = cookieGet;
  },
}));

describe("fetchClient", () => {
  const responseJson = vi.fn();
  const fetchMock = vi.fn();

  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    publishTestConfig({ routing: { apiBasePath: "/namespace-dev/service" } });
    responseJson.mockReset();
    fetchMock.mockReset();
    cookieGet.mockReset().mockReturnValue("csrf-token");
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
      `${window.location.origin}/namespace-dev/service/logout`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.any(Headers),
      }),
    );
    expect(fetchMock.mock.calls[0][1].headers.get("X-CSRF-TOKEN")).toBe("csrf-token");
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

  it.each(['GET', 'POST'])('preserves the HTTP status/code and adds guidance for %s without replay', async (method) => {
    cookieGet.mockImplementation((name) => name === 'csrf' ? 'new-user-token' : 'new-user');
    fetchMock.mockResolvedValue(new Response('ERR10039: mismatch', { status: 401 }));
    await expect(fetchClient('/portal/query', { method })).rejects.toBe(
      'HTTP 401: ERR10039: mismatch CSRF verification failed. Reload the page; if it still fails, sign out and sign in again.',
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('preserves structured CSRF error fields', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 'ERR10039', statusCode: 401, description: 'mismatch' }), { status: 401 }));
    await expect(fetchClient('/portal/command', { method: 'POST' })).rejects.toEqual({
      code: 'ERR10039', statusCode: 401,
      description: 'mismatch CSRF verification failed. Reload the page; if it still fails, sign out and sign in again.',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    { 'x-csrf-token': 'custom', 'content-type': 'text/plain' },
    new Headers({ 'x-csrf-token': 'custom', 'content-type': 'text/plain' }),
    [['x-csrf-token', 'custom'], ['content-type', 'text/plain']],
  ])('merges caller headers case-insensitively (%s)', async (headers) => {
    cookieGet.mockReturnValueOnce('old-token').mockReturnValue('new-token');
    fetchMock.mockResolvedValue(new Response('ERR10039: mismatch', { status: 401 }));
    await expect(fetchClient('/portal/query', { headers })).rejects.toContain('HTTP 401: ERR10039');
    const sent = fetchMock.mock.calls[0][1].headers;
    expect(sent.get('X-CSRF-TOKEN')).toBe('custom');
    expect(sent.get('Content-Type')).toBe('text/plain');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    [401, 'ERR10000: invalid JWT'],
    [403, 'ERR10039: mismatch'],
    [401, 'Other error mentioning ERR10039'],
  ])('preserves unrelated errors (%s, %s)', async (status, error) => {
    fetchMock.mockResolvedValue(new Response(error, { status }));
    await expect(fetchClient('/portal/query')).rejects.toBe(`HTTP ${status}: ${error}`);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
