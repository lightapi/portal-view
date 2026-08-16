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
vi.mock('./ServiceEndpointAccessOverviewDrawer', () => ({
  default: ({ open }: {
    open: boolean;
  }) => open ? (
    <div role="dialog" aria-label="Access Overview" />
  ) : null,
}));

vi.mock('material-react-table', () => ({
  useMaterialReactTable: (config: Record<string, unknown>) => config,
  MaterialReactTable: ({ table }: { table: {
    data: Array<{ endpointId: string }>;
    enableRowSelection?: boolean;
    renderTopToolbarCustomActions: () => React.ReactNode;
  } }) => (
    <div>
      <span>{`Rows: ${table.data.length}`}</span>
      <span>{`Row selection: ${table.enableRowSelection ? 'enabled' : 'disabled'}`}</span>
      {table.renderTopToolbarCustomActions()}
    </div>
  ),
}));

describe('ServiceEndpoint access overview entry point', () => {
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

  it('removes page-level selection and opens bulk access only through Access Overview', async () => {
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
    expect(screen.getByText('Row selection: disabled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bulk Access' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Access Overview' }));
    expect(await screen.findByRole('dialog', { name: 'Access Overview' })).toBeInTheDocument();
  });
});
