import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const configMock = vi.hoisted(() => ({
  signInUrl: '',
  basePath: '/',
  redirectUri: '',
  sso: false,
}));
vi.mock('../../config', () => ({
  config: configMock,
  get isSsoEnabled() {
    return configMock.sso;
  },
}));
vi.mock('../authConfig', () => ({ loginRequest: { scopes: ['openid', 'profile'] } }));

import { signIn } from './signIn';

const msal = () => ({ loginRedirect: vi.fn().mockResolvedValue(undefined) });

let assigned: string | null;
const realLocation = window.location;

beforeEach(() => {
  localStorage.clear();
  Object.assign(configMock, { signInUrl: '', basePath: '/', redirectUri: '', sso: false });
  assigned = null;
  // jsdom cannot navigate: record what the page was sent to instead.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'https://portal.example.test',
      set href(value: string) {
        assigned = value;
      },
    },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  vi.restoreAllMocks();
});

describe('signIn with SSO enabled', () => {
  it('redirects through MSAL, back to /redirect under the base path', async () => {
    configMock.sso = true;
    configMock.basePath = '/portal/';
    const instance = msal();
    await signIn(instance as never);
    expect(instance.loginRedirect).toHaveBeenCalledWith({
      scopes: ['openid', 'profile'],
      redirectUri: 'https://portal.example.test/portal/redirect',
    });
    expect(assigned).toBeNull();
    expect(localStorage.getItem('portal_auth_state')).toBeNull();
  });

  it('prefers a configured redirect address', async () => {
    configMock.sso = true;
    configMock.redirectUri = 'https://elsewhere.example.test/redirect';
    const instance = msal();
    await signIn(instance as never);
    expect(instance.loginRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ redirectUri: 'https://elsewhere.example.test/redirect' }),
    );
  });

  it('never falls back to the standard sign-in page, with or without an instance', async () => {
    configMock.sso = true;
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
  it('goes to the configured sign-in service with a fresh state it remembers', async () => {
    configMock.signInUrl = 'https://signin.example.test?client_id=abc';
    await signIn();
    const state = localStorage.getItem('portal_auth_state');
    expect(state).toBeTruthy();
    expect(assigned).toBe(`https://signin.example.test?client_id=abc&user_type=E&state=${state}`);
  });

  it('uses the local default when none is configured, and ignores any MSAL instance', async () => {
    const instance = msal();
    await signIn(instance as never);
    expect(assigned).toMatch(/^https:\/\/signin\.localhost\?client_id=.+&user_type=E&state=.+/);
    expect(instance.loginRedirect).not.toHaveBeenCalled();
  });
});
