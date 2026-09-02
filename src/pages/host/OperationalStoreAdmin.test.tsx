import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import OperationalStoreAdmin from './OperationalStoreAdmin';

vi.mock('../../utils/fetchClient', () => ({ default: vi.fn() }));
vi.mock('../../api/apiPost', () => ({ apiPost: vi.fn() }));
vi.mock('../../contexts/UserContext', () => ({
  useUserState: () => ({ roles: 'host-admin' }),
}));
vi.mock('../../components/HelpLink', () => ({
  default: () => <span>Help</span>,
}));

const HOST_ID = '00000000-0000-0000-0000-000000000001';
const BINDING_ID = '00000000-0000-0000-0000-000000000002';

const registeredBinding = {
  contractVersion: 2,
  bindingId: BINDING_ID,
  bindingDigest: 'sha256:registration',
  hostId: HOST_ID,
  scopeKind: 'HOST',
  engine: 'POSTGRESQL',
  serverHost: 'postgres.internal',
  port: 5432,
  expectedDatabase: 'operations_networknt',
  tlsMode: 'VERIFY_FULL',
  credentialSource: 'MOUNTED_FILE',
  credentialReference: '/run/secrets/operational-database-url',
  minimumSchemaGeneration: 2,
  credentialGeneration: 1,
  lifecycleState: 'REGISTERED',
  aggregateVersion: 4,
  active: true,
  published: true,
};

function mockQueries(bindings: object[]) {
  vi.mocked(fetchClient).mockImplementation(async url => {
    const command = JSON.parse(new URL(url, 'http://localhost').searchParams.get('cmd') ?? '{}');
    if (command.action === 'getOperationalStoreBindings') return { bindings };
    if (command.action === 'getHostById') return { domain: 'networknt.com', subDomain: 'dev' };
    throw new Error(`Unexpected query: ${command.action}`);
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/app/host/operationalStore?hostId=${HOST_ID}`]}>
      <OperationalStoreAdmin />
    </MemoryRouter>,
  );
}

describe('OperationalStoreAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiPost).mockResolvedValue({ data: { eventsAccepted: true } });
  });

  it('registers an existing database for the selected Host without provisioning fields or secrets', async () => {
    mockQueries([]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Host: dev.networknt.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('Environment')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Storage profile')).not.toBeInTheDocument();
    expect(screen.queryByText(/Provisioning job/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request provisioning/i })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Database server/), 'postgres.internal');
    await user.type(screen.getByLabelText(/Database name/), 'operations_networknt');
    await user.click(screen.getByRole('button', { name: 'Register storage' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledOnce());
    const command = vi.mocked(apiPost).mock.calls[0][0].body;
    expect(command).toMatchObject({
      action: 'registerOperationalStoreBinding',
      version: '0.2.0',
      data: {
        targetHostId: HOST_ID,
        engine: 'POSTGRESQL',
        serverHost: 'postgres.internal',
        port: 5432,
        expectedDatabase: 'operations_networknt',
        tlsMode: 'VERIFY_FULL',
        credentialSource: 'MOUNTED_FILE',
        credentialReference: '/run/secrets/operational-database-url',
        minimumSchemaGeneration: 2,
        credentialGeneration: 1,
      },
    });
    expect(command.data).not.toHaveProperty('environment');
    expect(command.data).not.toHaveProperty('profile');
    expect(command.data).not.toHaveProperty('password');
    expect(command.data).not.toHaveProperty('databaseUrl');
    expect(vi.mocked(apiPost).mock.calls[0][0].headers).toEqual({
      'Idempotency-Key': expect.any(String),
    });
  });

  it('renders a registered descriptor and deactivates publication without a database operation', async () => {
    mockQueries([registeredBinding]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('REGISTERED')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText(/postgres\.internal:5432/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update registration' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledOnce());
    expect(vi.mocked(apiPost).mock.calls[0][0].body).toMatchObject({
      action: 'deactivateOperationalStoreBinding',
      version: '0.2.0',
      data: { targetHostId: HOST_ID, aggregateVersion: 4 },
    });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('database will not be changed'));
  });

  it('updates and reactivates a deactivated registration with optimistic concurrency', async () => {
    mockQueries([{
      ...registeredBinding,
      lifecycleState: 'DEACTIVATED',
      published: false,
    }]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('DEACTIVATED')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    const databaseName = screen.getByLabelText(/Database name/);
    await user.clear(databaseName);
    await user.type(databaseName, 'operations_networknt_v2');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Reactivate registration' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledOnce());
    expect(vi.mocked(apiPost).mock.calls[0][0].body).toMatchObject({
      action: 'updateOperationalStoreBinding',
      version: '0.2.0',
      data: {
        targetHostId: HOST_ID,
        aggregateVersion: 4,
        expectedDatabase: 'operations_networknt_v2',
      },
    });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining(
      'Reactivate this registration and republish runtime configuration',
    ));
  });

  it('unregisters only the active control-plane binding', async () => {
    mockQueries([registeredBinding]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Unregister' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledOnce());
    expect(vi.mocked(apiPost).mock.calls[0][0].body).toMatchObject({
      action: 'unregisterOperationalStoreBinding',
      version: '0.2.0',
      data: { targetHostId: HOST_ID, aggregateVersion: 4 },
    });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('database and credentials will not be changed'));
  });

  it('keeps an unregistered record as history and offers a new registration', async () => {
    mockQueries([{
      ...registeredBinding,
      lifecycleState: 'UNREGISTERED',
      active: false,
      published: false,
    }]);
    renderPage();

    expect(await screen.findByText('UNREGISTERED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register storage' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unregister' })).not.toBeInTheDocument();
  });
});
