import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const configMock = vi.hoisted(() => ({ signInUrl: '', sso: false }));
vi.mock('../../../config', () => ({
  config: configMock,
  get isSsoEnabled() {
    return configMock.sso;
  },
}));
vi.mock('../../utils/fetchClient', () => ({ default: vi.fn() }));
vi.mock('../../utils/signIn', () => ({ signIn: vi.fn() }));
const msalInstance = vi.hoisted(() => ({ loginRedirect: () => Promise.resolve() }));
vi.mock('@azure/msal-react', () => ({ useMsal: () => ({ instance: msalInstance }) }));

import fetchClient from '../../utils/fetchClient';
import { signIn } from '../../utils/signIn';
import DeviceApproval from './DeviceApproval';

const mocked = vi.mocked(fetchClient);

const pending = {
  clientName: 'Light CLI (device login)',
  scope: 'portal.r portal.w',
  requestedFrom: '203.0.113.9',
  requestedSecondsAgo: 30,
  expiresIn: 840,
  sessionSeconds: 86_400,
  rememberSeconds: 7_776_000,
};

function open(query = '?provider=prov&user_code=BCDF-GHJK') {
  return render(
    <MemoryRouter initialEntries={[`/app/device${query}`]}>
      <DeviceApproval />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  configMock.sso = false;
  vi.mocked(signIn).mockClear();
});

describe('DeviceApproval', () => {
  it('looks up the code from the link and shows what is being approved', async () => {
    mocked.mockResolvedValueOnce(pending);
    open();
    expect(await screen.findByText('Light CLI (device login)')).toBeInTheDocument();
    expect(mocked).toHaveBeenCalledWith('/oauth2/prov/device/lookup?user_code=BCDFGHJK', { method: 'GET' });
    expect(screen.getByText('BCDF-GHJK')).toBeInTheDocument();
    expect(screen.getByText('203.0.113.9')).toBeInTheDocument();
    expect(screen.getByText(/portal\.r portal\.w/)).toBeInTheDocument();
    expect(screen.getByText(/Keep this device signed in for 90 days instead of 1 day/)).toBeInTheDocument();
  });

  it('does not let a click approve until the person confirms they started it', async () => {
    mocked.mockResolvedValueOnce(pending);
    open();
    const approve = await screen.findByRole('button', { name: 'Approve' });
    expect(approve).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I started this sign-in and the code matches'));
    expect(approve).toBeEnabled();
  });

  it('sends the decision as a form with the remember choice, and says how long the login lasts', async () => {
    mocked.mockResolvedValueOnce(pending).mockResolvedValueOnce({ status: 'approved', lifetimeSeconds: 7_776_000 });
    open();
    await screen.findByText('Light CLI (device login)');
    fireEvent.click(screen.getByLabelText('I started this sign-in and the code matches'));
    fireEvent.click(screen.getByLabelText(/Keep this device signed in/));
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText(/The device is signed in for 90 days/)).toBeInTheDocument();
    const [url, options] = mocked.mock.calls[1];
    expect(url).toBe('/oauth2/prov/device/approve');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(new URLSearchParams(options.body).get('user_code')).toBe('BCDFGHJK');
    expect(new URLSearchParams(options.body).get('action')).toBe('approve');
    expect(new URLSearchParams(options.body).get('remember')).toBe('true');
  });

  it('does not remember the login unless asked', async () => {
    mocked.mockResolvedValueOnce(pending).mockResolvedValueOnce({ status: 'approved', lifetimeSeconds: 86_400 });
    open();
    await screen.findByText('Light CLI (device login)');
    fireEvent.click(screen.getByLabelText('I started this sign-in and the code matches'));
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await screen.findByText(/signed in for 1 day/);
    expect(new URLSearchParams(mocked.mock.calls[1][1].body).get('remember')).toBe('false');
  });

  it('can be denied without any confirmation', async () => {
    mocked.mockResolvedValueOnce(pending).mockResolvedValueOnce({ status: 'denied' });
    open();
    await screen.findByText('Light CLI (device login)');
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
    expect(await screen.findByText(/will not be signed in/)).toBeInTheDocument();
    expect(new URLSearchParams(mocked.mock.calls[1][1].body).get('action')).toBe('deny');
  });

  it('asks the person to sign in on a 401, and keeps the request for after they do', async () => {
    mocked.mockRejectedValueOnce('HTTP 401 Unauthorized: invalid bearer token');
    open('?provider=tenant-9&user_code=BCDF-GHJK');
    expect(await screen.findByText(/Sign in to Portal to approve this request/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem('portal_device_request') ?? '{}');
    expect([saved.code, saved.provider]).toEqual(['BCDFGHJK', 'tenant-9']);
  });

  // The page signs in the way the rest of Portal does: through the shared helper, with the MSAL instance
  // when SSO is on and without one when it is not.
  it.each([
    [false, undefined],
    [true, msalInstance],
  ])('signs in through the shared helper (SSO %s)', async (sso, expectedInstance) => {
    configMock.sso = sso;
    mocked.mockRejectedValueOnce('HTTP 401 Unauthorized: invalid bearer token');
    open('?provider=tenant-9&user_code=BCDF-GHJK');
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(signIn).mock.calls[0][0]).toBe(expectedInstance);
  });

  it('picks up the saved request, provider included, when the person comes back without the link', async () => {
    localStorage.setItem('portal_device_request', JSON.stringify({ code: 'BCDFGHJK', provider: 'other', at: Date.now() }));
    mocked.mockResolvedValueOnce(pending);
    open('');
    expect(await screen.findByText('Light CLI (device login)')).toBeInTheDocument();
    expect(mocked.mock.calls[0][0]).toBe('/oauth2/other/device/lookup?user_code=BCDFGHJK');
    expect(localStorage.getItem('portal_device_request')).toBeNull();
  });

  it('ignores a saved request that is too old, or that has no usable provider', async () => {
    localStorage.setItem('portal_device_request', JSON.stringify({ code: 'BCDFGHJK', provider: 'prov', at: Date.now() - 3_600_000 }));
    open('');
    expect(await screen.findByText(/needs the link that/)).toBeInTheDocument();
    cleanup();
    localStorage.setItem('portal_device_request', JSON.stringify({ code: 'BCDFGHJK', provider: '../x', at: Date.now() }));
    open('');
    expect(await screen.findByText(/needs the link that/)).toBeInTheDocument();
    expect(mocked).not.toHaveBeenCalled();
  });

  it('says so when the code is unknown or expired', async () => {
    mocked.mockRejectedValueOnce('HTTP 404 Not Found: that code is not valid or has expired');
    open();
    expect(await screen.findByText(/not valid or has expired/)).toBeInTheDocument();
  });

  // light-oauth answers with a JSON body and `fetchClient` throws it as the parsed object.
  it.each([
    [{ status: 'expired' }, /has expired/],
    [{ status: 'forbidden' }, /may not sign in this device/],
    [{ status: 'not_found' }, /not valid, or it was already used/],
  ])('shows the outcome when the server refuses the decision with %j', async (thrown, text) => {
    mocked.mockResolvedValueOnce(pending).mockRejectedValueOnce(thrown);
    open();
    await screen.findByText('Light CLI (device login)');
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
    expect(await screen.findByText(text)).toBeInTheDocument();
    // The decision is over: nothing is left to click.
    expect(screen.queryByRole('button', { name: 'Deny' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('still reads a refusal that came back as text', async () => {
    mocked.mockResolvedValueOnce(pending).mockRejectedValueOnce('HTTP 410 Gone');
    open();
    await screen.findByText('Light CLI (device login)');
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
    expect(await screen.findByText(/has expired/)).toBeInTheDocument();
  });

  it('refuses a typed code that cannot be one, without asking the server', async () => {
    open('?provider=prov');
    fireEvent.change(await screen.findByLabelText('Code'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/not a valid code/)).toBeInTheDocument();
    expect(mocked).not.toHaveBeenCalled();
  });

  it('looks up a code that was typed, under the provider the link named', async () => {
    mocked.mockResolvedValueOnce(pending);
    open('?provider=prov');
    fireEvent.change(await screen.findByLabelText('Code'), { target: { value: 'bcdf-ghjk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Light CLI (device login)')).toBeInTheDocument();
    expect(mocked.mock.calls[0][0]).toBe('/oauth2/prov/device/lookup?user_code=BCDFGHJK');
  });

  it('uses the provider the link names, not one from this portal', async () => {
    mocked.mockResolvedValueOnce(pending).mockResolvedValueOnce({ status: 'approved', lifetimeSeconds: 86_400 });
    open('?provider=tenant-2_x&user_code=BCDF-GHJK');
    await screen.findByText('Light CLI (device login)');
    expect(mocked.mock.calls[0][0]).toBe('/oauth2/tenant-2_x/device/lookup?user_code=BCDFGHJK');
    fireEvent.click(screen.getByLabelText('I started this sign-in and the code matches'));
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await screen.findByText(/signed in for 1 day/);
    expect(mocked.mock.calls[1][0]).toBe('/oauth2/tenant-2_x/device/approve');
  });

  it.each(['', '../admin', 'a/b', 'a b', '%2e%2e', '.', 'x'.repeat(65)])(
    'refuses a link whose provider is %j, and calls nothing',
    async (provider) => {
      open(`?provider=${encodeURIComponent(provider)}&user_code=BCDF-GHJK`);
      expect(await screen.findByText(/needs the link that/)).toBeInTheDocument();
      expect(mocked).not.toHaveBeenCalled();
    },
  );

  it('asks for the link when there is no provider at all', async () => {
    open('?user_code=BCDF-GHJK');
    expect(await screen.findByText(/needs the link that/)).toBeInTheDocument();
    expect(mocked).not.toHaveBeenCalled();
  });
});
