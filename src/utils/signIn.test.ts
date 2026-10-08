import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishTestConfig } from '../test/runtimeConfigFixture';
import { resetPortalConfigForTests } from '../runtimeConfig/store';

vi.mock('../authConfig', () => ({ loginRequest: { scopes: ['openid', 'profile'] } }));
import { signIn } from './signIn';

const entra = {
  mode: 'entra-sso' as const,
  tenantId: '3f2b8c1e-7a4d-4e2b-9c1f-5d6e7a8b9c0d',
  clientId: 'e4d9217c-829a-44ce-961b-845fb6c5a82e',
};
const msal = () => ({ loginRedirect: vi.fn().mockResolvedValue(undefined) });
let assigned: string | null;
const realLocation = window.location;

beforeEach(() => {
  localStorage.clear();
  assigned = null;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: 'https://portal.example.test', set href(value: string) { assigned = value; } },
  });
});
afterEach(() => {
  resetPortalConfigForTests();
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  vi.restoreAllMocks();
});

describe('signIn with SSO enabled', () => {
  beforeEach(() => publishTestConfig({ authentication: entra }));

  it.each(['/', '/portal', '/namespace-dev/service/ai/portal'])(
    'redirects through MSAL under %s', async publicBasePath => {
      resetPortalConfigForTests();
      publishTestConfig({ authentication: entra, routing: { publicBasePath } });
      const instance = msal();
      await signIn(instance as never);
      expect(instance.loginRedirect).toHaveBeenCalledWith({
        scopes: ['openid', 'profile'],
        redirectUri: `https://portal.example.test${publicBasePath === '/' ? '' : publicBasePath}/redirect`,
      });
      expect(assigned).toBeNull();
      expect(localStorage.getItem('portal_auth_state')).toBeNull();
    },
  );

  it('prefers a configured redirect address', async () => {
    resetPortalConfigForTests();
    publishTestConfig({ authentication: { ...entra, redirectUri: 'https://elsewhere.example.test/redirect' } });
    const instance = msal();
    await signIn(instance as never);
    expect(instance.loginRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ redirectUri: 'https://elsewhere.example.test/redirect' }),
    );
  });

  it('never falls back to the standard sign-in page, with or without an instance', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await signIn(undefined);
    expect(error).toHaveBeenCalledWith('MSAL instance unavailable while SSO is enabled');
    const failing = { loginRedirect: vi.fn().mockRejectedValue(new Error('popup blocked')) };
    await signIn(failing as never);
    expect(error).toHaveBeenCalledWith('Login error:', expect.any(Error));
    expect(assigned).toBeNull();
  });
});

describe('signIn without SSO', () => {
  beforeEach(() => publishTestConfig());

  it.each([
    'https://signin.example.test?client_id=abc&prompt=login',
    '/signin?client_id=abc&prompt=login',
  ])('preserves configured queries and replaces stored state for %s', async signInUrl => {
    resetPortalConfigForTests();
    publishTestConfig({ authentication: { mode: 'oauth2', signInUrl } });
    const uuid = 'bf529979-8a3a-4a4f-a60d-635f6558b8dd';
    const randomUUID = vi.spyOn(crypto, 'randomUUID').mockReturnValue(uuid);
    localStorage.setItem('portal_auth_state', 'previous-state');
    const instance = msal();
    await signIn(instance as never);
    const url = new URL(assigned!);
    expect(url.origin).toBe(signInUrl.startsWith('/') ? 'https://portal.example.test' : 'https://signin.example.test');
    expect(url.searchParams.getAll('client_id')).toEqual(['abc']);
    expect(url.searchParams.get('prompt')).toBe('login');
    expect(url.searchParams.getAll('user_type')).toEqual(['E']);
    expect(url.searchParams.getAll('state')).toEqual([uuid]);
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(localStorage.getItem('portal_auth_state')).toBe(uuid);
    expect(instance.loginRedirect).not.toHaveBeenCalled();
  });

  it('fails without runtime configuration instead of using a localhost fallback', async () => {
    resetPortalConfigForTests();
    await expect(signIn()).rejects.toThrow('Portal runtime configuration is not loaded');
    expect(assigned).toBeNull();
    expect(localStorage.getItem('portal_auth_state')).toBeNull();
  });
});
