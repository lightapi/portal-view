import { beforeEach, describe, expect, it, vi } from "vitest";
import { signOut } from "./UserContext";
import { logoutFromBackend } from "../api/auth";

const authMode = vi.hoisted(() => ({ sso: true }));

vi.mock("../../config", () => ({
  config: { basePath: "/portal" },
  get isSsoEnabled() {
    return authMode.sso;
  },
}));

vi.mock("../api/auth", () => ({ logoutFromBackend: vi.fn() }));

const mockedLogout = vi.mocked(logoutFromBackend);

describe("signOut", () => {
  beforeEach(() => {
    authMode.sso = true;
    mockedLogout.mockReset();
  });

  it("continues Microsoft logout when backend logout rejects", async () => {
    const backendError = new Error("backend unavailable");
    mockedLogout.mockRejectedValue(backendError);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logoutRedirect = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn();

    await signOut(vi.fn(), navigate, undefined, { logoutRedirect } as any);

    expect(mockedLogout).toHaveBeenCalledOnce();
    expect(mockedLogout).toHaveBeenCalledWith("/auth/ms/logout");
    expect(logoutRedirect).toHaveBeenCalledWith({
      postLogoutRedirectUri: `${window.location.origin}/portal/redirect`,
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("uses stateless logout and navigates only after success", async () => {
    authMode.sso = false;
    mockedLogout.mockResolvedValue(undefined);
    const navigate = vi.fn();

    await signOut(vi.fn(), navigate);

    expect(mockedLogout).toHaveBeenCalledWith("/logout");
    expect(navigate).toHaveBeenCalledWith("/app/dashboard");
  });

  it("does not navigate when stateless logout fails", async () => {
    authMode.sso = false;
    mockedLogout.mockRejectedValue(new Error("CORS failure"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const navigate = vi.fn();

    await signOut(vi.fn(), navigate);

    expect(mockedLogout).toHaveBeenCalledWith("/logout");
    expect(navigate).not.toHaveBeenCalled();
  });
});
