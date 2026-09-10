import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ActionDisplayProvider } from '../../contexts/ActionDisplayContext';
import { ActionDisplayToggle } from '../../components/PortalActions/ActionDisplayToggle';
import { openPortalActions, selectPortalAction } from '../../test/portalActions';
import InstanceAdmin from './InstanceAdmin';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), publication: vi.fn() }));
vi.mock('../../contexts/UserContext', () => ({ useUserState: () => ({ host: 'host-a', userId: 'user-a', roles: 'admin' }) }));
vi.mock('../../utils/fetchClient', () => ({ default: mocks.fetch }));
vi.mock('../../tasks/TaskActionPanel', () => ({ default: () => null }));
vi.mock('../genai/AgentPolicyPublicationDialog', () => ({ default: (props: unknown) => { mocks.publication(props); return <div>Publication dialog</div>; } }));
vi.mock('material-react-table', () => ({
  useMaterialReactTable: (options: unknown) => options,
  MaterialReactTable: ({ table }: any) => <>
    {table.renderTopToolbarCustomActions()}
    <output data-testid="column-width">{table.displayColumnDefOptions['mrt-row-actions'].size}</output>
    {table.data.map((original: any) => <div key={original.instanceId} data-testid={original.instanceId}>
      <input type="checkbox" aria-label={`Select ${original.instanceId}`}
        checked={Boolean(table.state.rowSelection[table.getRowId(original)])}
        onChange={event => table.onRowSelectionChange({ ...table.state.rowSelection, [table.getRowId(original)]: event.target.checked })} />
      {table.renderRowActions({ row: { original } })}
    </div>)}
  </>,
}));
const base = { hostId: 'host-a', productVersionId: 'pv-a', active: true, current: true, readonly: false, envTag: 'dev' };
beforeEach(() => {
  localStorage.clear();
  mocks.fetch.mockResolvedValue({ instances: [
    { ...base, instanceId: 'gateway', productId: 'gtw', serviceId: 'gateway-service' },
    { ...base, instanceId: 'agent', productId: 'agt', serviceId: 'agent-service' },
    { ...base, instanceId: 'readonly-agent', productId: 'agt', readonly: true },
  ], total: 3 });
});
function Location() { return <output data-testid="location">{useLocation().pathname}{useLocation().search}</output>; }
function mount() { return render(<ActionDisplayProvider><MemoryRouter initialEntries={['/app/instance/InstanceAdmin']}><ActionDisplayToggle /><Location /><InstanceAdmin /></MemoryRouter></ActionDisplayProvider>); }

it('offers 11 common actions and the two agent actions only on agt records', async () => {
  mount();
  await openPortalActions(await screen.findByTestId('gateway'));
  expect(screen.getAllByRole('menuitem')).toHaveLength(11);
  expect(screen.queryByRole('menuitem', { name: 'Open Agent chat' })).not.toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  await openPortalActions(screen.getByTestId('agent'));
  expect(screen.getAllByRole('menuitem')).toHaveLength(13);
  expect(screen.getAllByRole('menuitem').at(-1)).toHaveAccessibleName('Delete Instance');
});

it('keeps readonly policy and clone actions disabled with visible explanations', async () => {
  mount();
  await openPortalActions(await screen.findByTestId('readonly-agent'));
  expect(screen.getByRole('menuitem', { name: 'Clone Instance' })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByRole('menuitem', { name: 'Publish Agent policy' })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByText('Read-only instances cannot be cloned.')).toBeVisible();
  expect(screen.getByText('Read-only instances cannot publish policies.')).toBeVisible();
});

it('preserves the selected agent identifiers when opening Chat and policy publication', async () => {
  mount();
  await selectPortalAction('Publish Agent policy', await screen.findByTestId('agent'));
  expect(mocks.publication).toHaveBeenCalledWith(expect.objectContaining({ hostId: 'host-a', instanceId: 'agent', serviceId: 'agent-service' }));
  await selectPortalAction('Open Agent chat', screen.getByTestId('agent'));
  // Menu closure and the router's navigation transition can commit separately.
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/app/genai/chat?instanceId=agent&serviceId=agent-service&envTag=dev'));
});

it('changes all rows and column sizing while preserving selection and avoiding a data refetch', async () => {
  mount();
  const agent = await screen.findByTestId('agent');
  await userEvent.click(within(agent).getByRole('checkbox'));
  const fetchCount = mocks.fetch.mock.calls.length;
  expect(screen.getByTestId('column-width')).toHaveTextContent('120');
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Expanded buttons' }));
  expect(screen.getByTestId('column-width')).toHaveTextContent('80');
  expect(within(agent).getByRole('checkbox')).toBeChecked();
  expect(within(agent).getByRole('button', { name: 'Open Agent chat' })).toBeVisible();
  expect(within(screen.getByTestId('gateway')).queryByRole('button', { name: 'Open Agent chat' })).not.toBeInTheDocument();
  expect(mocks.fetch).toHaveBeenCalledTimes(fetchCount);
});
