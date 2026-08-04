import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fetchClient from '../../utils/fetchClient';
import ServiceEndpointAccessOverviewDrawer from './ServiceEndpointAccessOverviewDrawer';

vi.mock('../../utils/fetchClient', () => ({
  default: vi.fn(),
}));

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

describe('ServiceEndpointAccessOverviewDrawer', () => {
  beforeEach(() => {
    vi.mocked(fetchClient).mockReset();
  });

  it('shows the endpoint action without the shared transport path', async () => {
    vi.mocked(fetchClient).mockResolvedValue({
      total: 1,
      summary: {
        withoutAccess: 0,
        withRules: 0,
        withPermissions: 1,
        withRowFilters: 0,
        withColumnFilters: 0,
      },
      endpoints: [{
        endpointId: 'endpoint-1',
        endpoint: 'lightapi.net/genai/getLlmGatewayPublicationCandidate/0.1.0',
        endpointName: 'getLlmGatewayPublicationCandidate',
        httpMethod: 'post',
        endpointPath: '/portal/query',
        rules: {},
        permissions: { roles: [{ roleId: 'admin' }] },
        rowFilters: {},
        columnFilters: {},
        status: 'Permissions configured',
      }],
    });

    render(
      <ServiceEndpointAccessOverviewDrawer
        open
        hostId="host-1"
        apiVersionId="version-1"
        refreshKey={0}
        highlightedEndpointIds={[]}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('getLlmGatewayPublicationCandidate')).toBeInTheDocument();
    expect(screen.queryByText('POST /portal/query')).not.toBeInTheDocument();
  });

  it('falls back to the endpoint identifier when endpointName is unavailable', async () => {
    vi.mocked(fetchClient).mockResolvedValue({
      total: 1,
      summary: {},
      endpoints: [{
        endpointId: 'endpoint-1',
        endpoint: 'lightapi.net/genai/getLlmGatewayPublicationCandidate/0.1.0',
        httpMethod: 'post',
        endpointPath: '/portal/query',
        rules: {},
        permissions: {},
        rowFilters: {},
        columnFilters: {},
        status: 'No access configured',
      }],
    });

    render(
      <ServiceEndpointAccessOverviewDrawer
        open
        hostId="host-1"
        apiVersionId="version-1"
        refreshKey={0}
        highlightedEndpointIds={[]}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('lightapi.net/genai/getLlmGatewayPublicationCandidate/0.1.0')).toBeInTheDocument();
  });

  it('selects all visible missing endpoints and opens bulk access for that selection', async () => {
    vi.mocked(fetchClient).mockResolvedValue({
      total: 2,
      summary: { withoutAccess: 1 },
      endpoints: [
        {
          endpointId: 'missing-endpoint',
          endpoint: 'lightapi.net/genai/getMissingAction/0.1.0',
          endpointName: 'getMissingAction',
          httpMethod: 'post',
          endpointPath: '/portal/query',
          rules: {}, permissions: {}, rowFilters: {}, columnFilters: {},
          status: 'No access configured',
        },
        {
          endpointId: 'configured-endpoint',
          endpoint: 'lightapi.net/genai/getConfiguredAction/0.1.0',
          endpointName: 'getConfiguredAction',
          httpMethod: 'post',
          endpointPath: '/portal/query',
          rules: {}, permissions: { roles: [{ roleId: 'admin' }] }, rowFilters: {}, columnFilters: {},
          status: 'Permissions configured',
        },
      ],
    });

    render(
      <ServiceEndpointAccessOverviewDrawer
        open
        hostId="host-1"
        apiVersionId="version-1"
        refreshKey={0}
        highlightedEndpointIds={[]}
        onClose={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    await screen.findByText('getMissingAction');
    await user.click(screen.getByRole('switch', { name: 'Missing only' }));
    expect(screen.queryByText('getConfiguredAction')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Select all visible endpoints' }));
    const bulkButton = screen.getByRole('button', { name: 'Bulk Access (1)' });
    expect(bulkButton).toBeEnabled();

    await user.click(bulkButton);
    expect(await screen.findByText('Bulk editor endpoints: 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Simulate successful update' }));
    expect(screen.getByRole('dialog', { name: 'Bulk Access' })).toBeInTheDocument();
    expect(screen.getByText('Bulk editor endpoints: 1')).toBeInTheDocument();
  });
});
