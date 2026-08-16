import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import ApiGatewayPublicationDialog from './ApiGatewayPublicationDialog';

vi.mock('../../utils/fetchClient', () => ({ default: vi.fn() }));
vi.mock('../../api/apiPost', () => ({ apiPost: vi.fn() }));

const HOST_ID = '00000000-0000-0000-0000-000000000001';
const API_VERSION_ID = '00000000-0000-0000-0000-000000000002';
const INSTANCE_ID = '00000000-0000-0000-0000-000000000003';

const candidate = {
  instanceId: INSTANCE_ID,
  instanceName: 'Test Gateway',
  serviceId: 'com.example.gateway',
  productVersion: '2.1.0',
  acceptedRevision: 12,
  projectedRevision: 12,
  projectionReady: true,
  projectionFailure: false,
  versions: [{
    instanceApiId: '00000000-0000-0000-0000-000000000004',
    apiVersionId: 'another-version',
    apiVersion: '1.0.0',
    selected: false,
    active: true,
    pathPrefixes: [{ pathPrefix: '/pets', active: true }],
    appBindings: [{ instanceAppId: 'application-binding-1', active: true, ownerActive: true }],
    properties: [{ active: true }, { active: false }],
  }],
};

const preview = {
  previewDigest: 'sha256:preview',
  expectedTargetAcceptedRevision: 12,
  associationAction: 'CREATE' as const,
  warnings: [{ code: 'ENDPOINT_WITHOUT_RULE', message: 'Endpoint has no configured rule', endpoint: 'GET /pets' }],
  blockingErrors: [],
  properties: [{ propertyId: 'endpointRules', propertyValue: '{"GET /pets":{}}', action: 'CREATE' }],
  retirements: [],
  dependencyDecisions: [{
    code: 'APPLICATION_BINDING',
    message: 'The Instance API is not selected for retirement',
    instanceApiId: '00000000-0000-0000-0000-000000000004',
    instanceAppId: 'application-binding-1',
    decision: 'KEEP_OLD_VERSION',
  }],
  sourceCounts: { endpoints: 1, rules: 0, ruleBodies: 0 },
};

describe('ApiGatewayPublicationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchClient)
      .mockResolvedValueOnce({ candidates: [candidate] })
      .mockResolvedValueOnce(preview);
    vi.mocked(apiPost).mockResolvedValue({
      data: {
        eventsAccepted: true,
        acceptedEventCount: 3,
        eventTransactionId: 'transaction-1',
        instanceApiId: 'new-instance-api',
      },
    });
  });

  it('requires warning acknowledgement and publishes the exact preview revision and digest', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ApiGatewayPublicationDialog
          open
          hostId={HOST_ID}
          apiVersionId={API_VERSION_ID}
          apiVersion="2.0.0"
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Projection revision 12 of 12/)).toBeInTheDocument();
    expect(screen.getByText(/Prefixes: \/pets; application bindings: 1; active properties: 1/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Preview' }));

    expect(await screen.findByText(/ENDPOINT_WITHOUT_RULE/)).toBeInTheDocument();
    expect(screen.getByText(/application-binding-1: KEEP_OLD_VERSION/)).toBeInTheDocument();
    const publishButton = screen.getByRole('button', { name: 'Publish events' });
    expect(publishButton).toBeDisabled();

    await user.click(screen.getByLabelText('I acknowledge all publication warnings'));
    expect(publishButton).toBeEnabled();
    await user.click(publishButton);

    await waitFor(() => expect(apiPost).toHaveBeenCalledOnce());
    expect(vi.mocked(apiPost).mock.calls[0][0].body.data).toMatchObject({
      hostId: HOST_ID,
      apiVersionId: API_VERSION_ID,
      instanceId: INSTANCE_ID,
      acknowledgedWarningCodes: ['ENDPOINT_WITHOUT_RULE'],
      expectedTargetAcceptedRevision: 12,
      expectedPreviewDigest: 'sha256:preview',
    });
    expect(await screen.findByText(/Gateway publication events accepted \(3\)/)).toBeInTheDocument();
    expect(screen.getByText(/Transaction: transaction-1/)).toBeInTheDocument();
    expect(screen.getByText(/Projection is asynchronous/)).toBeInTheDocument();
  });
});
