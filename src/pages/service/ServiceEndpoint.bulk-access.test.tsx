import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fetchClient from '../../utils/fetchClient';
import ServiceEndpoint from './ServiceEndpoint';

vi.mock('../../utils/fetchClient', () => ({
  default: vi.fn(),
}));

vi.mock('../../contexts/UserContext', () => ({
  useUserState: () => ({ host: 'host-1' }),
}));

vi.mock('../../tasks/TaskActionPanel', () => ({ default: () => null }));
vi.mock('../../components/HelpLink', () => ({ default: () => null }));
vi.mock('./ServiceEndpointAccessOverviewDrawer', () => ({ default: () => null }));

vi.mock('./ServiceEndpointBulkAccessDrawer', () => ({
  default: ({ open, endpoints, onSuccess, onClose }: {
    open: boolean;
    endpoints: Array<{ endpointId: string }>;
    onSuccess: () => void;
    onClose: () => void;
  }) => open ? (
    <div role="dialog" aria-label="Bulk Access">
      <span>{`Bulk editor endpoints: ${endpoints.length}`}</span>
      <button onClick={onSuccess}>Simulate successful update</button>
      <button onClick={onClose}>Close bulk access</button>
    </div>
  ) : null,
}));

vi.mock('material-react-table', () => ({
  useMaterialReactTable: (config: Record<string, unknown>) => config,
  MaterialReactTable: ({ table }: { table: {
    data: Array<{ endpointId: string }>;
    onRowSelectionChange: (selection: Record<string, boolean>) => void;
    renderTopToolbarCustomActions: () => React.ReactNode;
  } }) => (
    <div>
      <span>{`Rows: ${table.data.length}`}</span>
      <button onClick={() => table.onRowSelectionChange({ 'endpoint-1': true })}>Select endpoint</button>
      {table.renderTopToolbarCustomActions()}
    </div>
  ),
}));

describe('ServiceEndpoint bulk access', () => {
  beforeEach(() => {
    vi.mocked(fetchClient).mockReset();
    vi.mocked(fetchClient).mockResolvedValue({
      total: 1,
      endpoints: [{
        hostId: 'host-1',
        endpointId: 'endpoint-1',
        apiVersionId: 'version-1',
        apiId: 'api-1',
        apiVersion: '0.1.0',
        endpoint: 'lightapi.net/genai/getAction/0.1.0',
        httpMethod: 'post',
        endpointPath: '/portal/query',
        endpointDesc: 'getAction',
        active: true,
      }],
    });
  });

  it('keeps the editor open and the endpoints selected after a successful update', async () => {
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/app/serviceEndpoint',
        state: { data: { apiVersionId: 'version-1' } },
      }]}>
        <ServiceEndpoint />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await screen.findByText('Rows: 1');
    await user.click(screen.getByRole('button', { name: 'Select endpoint' }));
    await user.click(screen.getByRole('button', { name: 'Bulk Access' }));
    expect(await screen.findByText('Bulk editor endpoints: 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Simulate successful update' }));
    expect(screen.getByRole('dialog', { name: 'Bulk Access' })).toBeInTheDocument();
    expect(screen.getByText('Bulk editor endpoints: 1')).toBeInTheDocument();
  });
});
