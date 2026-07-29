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
});
