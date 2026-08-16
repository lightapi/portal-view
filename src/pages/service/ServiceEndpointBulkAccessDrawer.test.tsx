import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import ServiceEndpointBulkAccessDrawer from './ServiceEndpointBulkAccessDrawer';

vi.mock('../../api/apiPost', () => ({ apiPost: vi.fn() }));
vi.mock('../../utils/fetchClient', () => ({ default: vi.fn() }));

const endpoint = {
  hostId: 'host-1',
  endpointId: 'endpoint-1',
  apiVersionId: 'version-1',
  apiId: 'api-1',
  apiVersion: '0.1.0',
  endpoint: 'lightapi.net/service/getEndpoint/0.1.0',
  httpMethod: 'POST',
  endpointPath: '/portal/query',
  endpointDesc: 'Get endpoint',
  active: true,
};

describe('ServiceEndpointBulkAccessDrawer removal', () => {
  beforeEach(() => {
    vi.mocked(fetchClient).mockReset();
    vi.mocked(apiPost).mockReset();
    vi.mocked(fetchClient).mockResolvedValue({
      rules: [{ ruleId: 'rule-1', ruleName: 'Rule One' }],
    });
    vi.mocked(apiPost).mockResolvedValue({ data: { submitted: 1, skipped: 0, failed: 0 } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('submits an explicit remove action for a selected endpoint rule', async () => {
    const user = userEvent.setup();
    render(
      <ServiceEndpointBulkAccessDrawer
        open
        hostId="host-1"
        apiVersionId="version-1"
        endpoints={[endpoint]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Action' }));
    await user.click(screen.getByRole('option', { name: 'Remove' }));

    expect(screen.queryByRole('combobox', { name: 'Conflict Mode' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Rule ID' }));
    await user.click(await screen.findByRole('option', { name: 'rule-1 - Rule One' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        data: expect.objectContaining({
          accessAction: 'remove',
          operation: 'endpointRule',
          endpointIds: ['endpoint-1'],
          payload: { ruleId: 'rule-1' },
        }),
      }),
    })));
    expect(window.confirm).toHaveBeenCalledWith('Remove the selected endpoint rule from 1 endpoints?');
  });

  it('limits remove mode to rules and permissions', async () => {
    const user = userEvent.setup();
    render(
      <ServiceEndpointBulkAccessDrawer
        open
        hostId="host-1"
        apiVersionId="version-1"
        endpoints={[endpoint]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Action' }));
    await user.click(screen.getByRole('option', { name: 'Remove' }));
    await user.click(screen.getByRole('combobox', { name: 'Operation' }));

    expect(screen.getByRole('option', { name: 'Endpoint Rule' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Role Permission' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Attribute Permission' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Role Row Filter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Role Column Filter' })).not.toBeInTheDocument();
  });
});
