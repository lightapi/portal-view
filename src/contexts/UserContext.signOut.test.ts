import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signOut } from "./UserContext";
import { logoutFromBackend } from "../api/auth";

import { publishTestConfig } from "../test/runtimeConfigFixture";
import { resetPortalConfigForTests } from "../runtimeConfig/store";
const entra = {
  mode: 'entra-sso' as const,
  tenantId: '3f2b8c1e-7a4d-4e2b-9c1f-5d6e7a8b9c0d',
  clientId: 'e4d9217c-829a-44ce-961b-845fb6c5a82e',
};
afterEach(() => { resetPortalConfigForTests(); vi.restoreAllMocks(); });

vi.mock("../api/auth", () => ({ logoutFromBackend: vi.fn() }));

const mockedLogout = vi.mocked(logoutFromBackend);

describe("signOut", () => {
  beforeEach(() => {
    publishTestConfig({ authentication: entra, routing: { publicBasePath: "/portal" } });
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
    resetPortalConfigForTests();
    publishTestConfig();
    mockedLogout.mockResolvedValue(undefined);
    const navigate = vi.fn();

    await signOut(vi.fn(), navigate);

    expect(mockedLogout).toHaveBeenCalledWith("/logout");
    expect(navigate).toHaveBeenCalledWith("/app/dashboard");
  });

  it("does not navigate when stateless logout fails", async () => {
    resetPortalConfigForTests();
    publishTestConfig();
    mockedLogout.mockRejectedValue(new Error("CORS failure"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const navigate = vi.fn();

    await signOut(vi.fn(), navigate);

    expect(mockedLogout).toHaveBeenCalledWith("/logout");
    expect(navigate).not.toHaveBeenCalled();
  });
  it.each(['/', '/namespace-dev/service/ai/portal'])('uses the configured base %s for logout', async publicBasePath => {
    resetPortalConfigForTests();
    publishTestConfig({ authentication: entra, routing: { publicBasePath } });
    const logoutRedirect = vi.fn().mockResolvedValue(undefined);
    await signOut(vi.fn(), vi.fn(), undefined, { logoutRedirect } as never);
    expect(logoutRedirect).toHaveBeenCalledWith({
      postLogoutRedirectUri: `${window.location.origin}${publicBasePath === '/' ? '' : publicBasePath}/redirect`,
    });
  });

  it('honors the explicit post-logout URI independently of the login redirect', async () => {
    resetPortalConfigForTests();
    publishTestConfig({ authentication: { ...entra,
      redirectUri: 'https://login.example.test/redirect',
      postLogoutRedirectUri: 'https://logout.example.test/signed-out',
    } });
    const logoutRedirect = vi.fn().mockResolvedValue(undefined);
    await signOut(vi.fn(), vi.fn(), undefined, { logoutRedirect } as never);
    expect(logoutRedirect).toHaveBeenCalledWith({ postLogoutRedirectUri: 'https://logout.example.test/signed-out' });
  });

});
