import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fetchClient from "../utils/fetchClient";
import { exchangeToken, logoutFromBackend } from "./auth";

vi.mock("../utils/fetchClient", () => ({ default: vi.fn() }));

const mockedFetchClient = vi.mocked(fetchClient);

describe("auth API", () => {
  beforeEach(() => {
    mockedFetchClient.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exchanges the Microsoft token with a bodyless POST", async () => {
    mockedFetchClient.mockResolvedValue({});

    await exchangeToken("microsoft-id-token");

    expect(mockedFetchClient).toHaveBeenCalledOnce();
    expect(mockedFetchClient).toHaveBeenCalledWith("/auth/ms/exchange", {
      method: "POST",
      headers: { Authorization: "Bearer microsoft-id-token" },
    });
    expect(mockedFetchClient.mock.calls[0][0]).not.toContain("microsoft-id-token");
    expect(mockedFetchClient.mock.calls[0][1]).not.toHaveProperty("body");
  });

  it.each(["/auth/ms/logout", "/logout"] as const)(
    "logs out through %s with a bodyless POST",
    async (endpoint) => {
      mockedFetchClient.mockResolvedValue({});

      await logoutFromBackend(endpoint);

      expect(mockedFetchClient).toHaveBeenCalledWith(endpoint, { method: "POST" });
      expect(mockedFetchClient.mock.calls[0][1]).not.toHaveProperty("body");
    },
  );

  it("does not retry a structured method rejection", async () => {
    const rejection = { code: "ERR10008" };
    mockedFetchClient.mockRejectedValue(rejection);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(exchangeToken("token")).rejects.toBe(rejection);

    expect(mockedFetchClient).toHaveBeenCalledOnce();
  });

  it("retries a transient exchange failure", async () => {
    vi.useFakeTimers();
    mockedFetchClient
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({ exchanged: true });

    const resultPromise = exchangeToken("token");
    await vi.advanceTimersByTimeAsync(500);

    await expect(resultPromise).resolves.toEqual({ exchanged: true });
    expect(mockedFetchClient).toHaveBeenCalledTimes(2);
  });

  it("stops after ten transient exchange failures", async () => {
    vi.useFakeTimers();
    const rejection = new Error("persistent temporary failure");
    mockedFetchClient.mockRejectedValue(rejection);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const resultPromise = exchangeToken("token");
    const rejectionAssertion = expect(resultPromise).rejects.toBe(rejection);
    await vi.runAllTimersAsync();

    await rejectionAssertion;
    expect(mockedFetchClient).toHaveBeenCalledTimes(10);
  });
});
