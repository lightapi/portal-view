import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileMenu from './ProfileMenu';
import { publishTestConfig } from '../../test/runtimeConfigFixture';

vi.mock('../../authConfig', () => ({ loginRequest: { scopes: ['openid', 'profile'] } }));
vi.mock('../../contexts/UserContext', () => ({
  changePassword: vi.fn(), getOrders: vi.fn(), getPayment: vi.fn(), getProfile: vi.fn(),
  userHost: vi.fn(), createOrg: vi.fn(), signOut: vi.fn(), signUp: vi.fn(), updateRoles: vi.fn(),
  useUserDispatch: () => vi.fn(), useUserState: () => ({ isAuthenticated: false, roles: [] }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../PortalActions/ActionDisplayToggle', () => ({ ActionDisplayToggle: () => null }));

const realLocation = window.location;
let assigned: string | null;
beforeEach(() => {
  publishTestConfig({ authentication: { mode: 'oauth2', signInUrl: '/signin?client_id=example' } });
  assigned = null;
  localStorage.clear();
  Object.defineProperty(window, 'location', { configurable: true, value: {
    origin: 'http://portal.example.test', set href(value: string) { assigned = value; },
  } });
});
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function clickSignIn() {
  fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Sign In' }));
}

describe('ProfileMenu sign-in security', () => {
  it.each(['native', 'bytes'])('uses real cryptographic OAuth state through the menu (%s)', async mode => {
    const weak = vi.spyOn(Math, 'random');
    const native = vi.fn(() => '00000000-0000-4000-8000-000000000001');
    const bytes = vi.fn((value: Uint8Array) => value.fill(5));
    vi.stubGlobal('crypto', mode === 'native' ? { randomUUID: native } : { getRandomValues: bytes });
    render(<ProfileMenu />);
    clickSignIn();
    await waitFor(() => expect(assigned).not.toBeNull());
    const expected = mode === 'native' ? '00000000-0000-4000-8000-000000000001' : '05050505-0505-4505-8505-050505050505';
    expect(new URL(assigned!).searchParams.get('state')).toBe(expected);
    expect(localStorage.getItem('portal_auth_state')).toBe(expected);
    expect(mode === 'native' ? native : bytes).toHaveBeenCalledOnce();
    expect(weak).not.toHaveBeenCalled();
  });
  it('shows a visible error without state storage or redirect when crypto is unavailable, then allows retry', async () => {
    vi.stubGlobal('crypto', undefined);
    render(<ProfileMenu />);
    clickSignIn();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to sign in securely');
    expect(assigned).toBeNull();
    expect(localStorage.getItem('portal_auth_state')).toBeNull();
    vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-4000-8000-000000000002' });
    clickSignIn();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(new URL(assigned!).searchParams.get('state')).toBe('00000000-0000-4000-8000-000000000002');
  });
});
