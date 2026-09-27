import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ActionDisplayProvider} from '../../contexts/ActionDisplayContext';
const mocks = vi.hoisted(() => ({fetchClient: vi.fn()}));
vi.mock('../../contexts/UserContext', () => ({useUserState: () => ({host: 'host-a', userId: 'owner-a',
  roles: 'admin', positions: ''})}));
vi.mock('../../utils/fetchClient', () => ({default: mocks.fetchClient}));
vi.mock('material-react-table', () => ({
  useMaterialReactTable: (options: any) => options,
  MaterialReactTable: ({table}: {table: any}) => <div>
    <div>{table.data.length ? table.columns.find((column: any) => column.accessorKey === 'pendingBindingCount')
      ?.Cell({row: {original: table.data[0]}}) : null}</div>
    <button onClick={() => table.onColumnFiltersChange([{id: 'hasPendingBindings', value: 'true'}])}>
      Pending bindings only</button>
  </div>,
}));
import WfDefinition from './WfDefinition';

beforeEach(() => {mocks.fetchClient.mockReset().mockResolvedValue({workflows: [{wfDefId: 'definition-a',
  hostId: 'host-a', name: 'Orders', version: '1.0', pendingBindingCount: 3, active: true}], total: 1});});

describe('definition Tool binding badge and filter', () => {
  it('shows pending count and sends hasPendingBindings to the Step 10 query', async () => {
    render(<ActionDisplayProvider><MemoryRouter><WfDefinition /></MemoryRouter></ActionDisplayProvider>);
    expect(await screen.findByText('3 pending')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Pending bindings only'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(2));
    const url = mocks.fetchClient.mock.calls.at(-1)![0] as string;
    const cmd = JSON.parse(new URL(url, 'https://portal.test').searchParams.get('cmd')!);
    expect(JSON.parse(cmd.data.filters)).toContainEqual({id: 'hasPendingBindings', value: 'true'});
  });
});
