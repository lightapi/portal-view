import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({fetchClient: vi.fn(), apiPost: vi.fn(), publishBindings: vi.fn(),
  getBindingForTool: vi.fn(), retryOperation: vi.fn(), refreshBindings: vi.fn(), retireBinding: vi.fn()}));
vi.mock('../../utils/fetchClient', () => ({default: mocks.fetchClient}));
vi.mock('../../api/apiPost', () => ({apiPost: mocks.apiPost}));
vi.mock('../../contexts/UserContext', () => ({useUserState: () => ({userId: 'requester-a'})}));
vi.mock('../workflow/workflowAdminClient', () => ({workflowAdminClient: {getBindingForTool: mocks.getBindingForTool}}));
vi.mock('../workflow/workflowPortalClient', async importOriginal => {
  const original = await importOriginal<typeof import('../workflow/workflowPortalClient')>();
  return {...original, workflowPortalClient: {publishBindings: mocks.publishBindings,
    retryOperation: mocks.retryOperation, refreshBindings: mocks.refreshBindings,
    retireBinding: mocks.retireBinding}};
});
import GatewayToolPublicationDialog from './GatewayToolPublicationDialog';

function action(url: string) {
  const command = new URL(url, 'https://portal.test').searchParams.get('cmd');
  return command ? JSON.parse(command).action : '';
}
const tools = [{toolId: 'tool-a', name: 'Orders', executionPlacement: 'workflow'},
  {toolId: 'tool-b', name: 'Returns', executionPlacement: 'workflow'}];
const definitionOperationId = '11111111-1111-4111-8111-111111111111';
const retireOperationId = '22222222-2222-4222-8222-222222222222';
const expiredOperationId = '33333333-3333-4333-8333-333333333333';
const newRetireOperationId = '44444444-4444-4444-8444-444444444444';
const activeDefinitionReceipt = {result: 'published', status: 'active',
  wfDefId: '55555555-5555-4555-8555-555555555555', version: '1.0.0',
  definitionDigest: `sha256:${'a'.repeat(64)}`, schemaDigest: `sha256:${'b'.repeat(64)}`,
  bindingApproval: 'carryOver'};

beforeEach(() => {
  mocks.fetchClient.mockReset().mockImplementation((url: string) => {
    switch (action(url)) {
      case 'getInstance': return Promise.resolve({instances: [{instanceId: 'instance-a', instanceName: 'Gateway A', productId: 'gtw'}]});
      case 'getGatewayToolPublicationCandidate': return Promise.resolve({
        candidateDigest: 'sha256:candidate', expectedPublicationVersion: 1, publicationVersion: 2,
        changeSummary: {added: 1, updated: 0, removed: 0, unchanged: 0, total: 1},
        skippedTools: [{toolId: 'tool-b', name: 'Returns', reason: 'failed'}],
        accessPolicies: [], accessReadiness: [],
      });
      default: return Promise.resolve({});
    }
  });
  mocks.publishBindings.mockReset().mockResolvedValue({results: [
    {toolId: 'tool-a', status: 'active'},
    {toolId: 'tool-b', status: 'failed', code: 'WORKFLOW_INPUT_INVALID', message: 'Invalid reach'},
  ]});
  mocks.getBindingForTool.mockReset().mockResolvedValue({aggregateVersion: 4, revision: {owner: {userId: 'owner-a'}}});
  mocks.retryOperation.mockReset();
  mocks.refreshBindings.mockReset();
  mocks.retireBinding.mockReset().mockResolvedValue({result: 'retired', bindingId: 'revision-a'});
  mocks.apiPost.mockReset().mockResolvedValue({data: {}});
});

describe('Publish Selected Workflow Tools', () => {
  it('publishes per Tool first, retains mixed results, and shows backend skipped reasons', async () => {
    render(<MemoryRouter><GatewayToolPublicationDialog open hostId="host-a" tools={tools} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('Gateway A');
    fireEvent.click(screen.getByRole('button', {name: 'Preview changes'}));
    await waitFor(() => expect(mocks.publishBindings).toHaveBeenCalledWith('host-a', ['tool-a', 'tool-b']));
    expect(await screen.findByText('Orders: Published')).toBeInTheDocument();
    expect(screen.getByText('Returns: WORKFLOW_INPUT_INVALID: Invalid reach')).toBeInTheDocument();
    expect(screen.getByText('Returns: skipped — failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Preview changes'}));
    await waitFor(() => expect(mocks.publishBindings).toHaveBeenCalledTimes(1));
  });
  it('shows pending owner approval', async () => {
    mocks.publishBindings.mockResolvedValue({results: [{toolId: 'tool-a', status: 'pending'}]});
    render(<MemoryRouter><GatewayToolPublicationDialog open hostId="host-a" tools={[tools[0]]} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('Gateway A');
    fireEvent.click(screen.getByRole('button', {name: 'Preview changes'}));
    expect(await screen.findByText('Orders: Waiting for approval from owner-a')).toBeInTheDocument();
  });
  it('keeps every binding outcome visible when the batch request is unconfirmed', async () => {
    mocks.publishBindings.mockRejectedValue({code: 'WORKFLOW_OPERATION_UNCONFIRMED',
      message: 'Request aborted; outcome unconfirmed.'});
    render(<MemoryRouter><GatewayToolPublicationDialog open hostId="host-a" tools={tools} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('Gateway A');
    fireEvent.click(screen.getByRole('button', {name: 'Preview changes'}));
    expect(await screen.findByText(/Orders: WORKFLOW_OPERATION_UNCONFIRMED/)).toBeInTheDocument();
    expect(screen.getByText(/Returns: WORKFLOW_OPERATION_UNCONFIRMED/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Refresh status'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Preview changes'}));
    await waitFor(() => expect(mocks.publishBindings).toHaveBeenCalledTimes(1));
  });
  it('offers one Retry for a batch error with one operation ID and keeps Tool outcomes unconfirmed', async () => {
    mocks.publishBindings.mockRejectedValue({code: 'WORKFLOW_OPERATION_UNCONFIRMED',
      message: 'Batch outcome unknown', details: {operationId: definitionOperationId}});
    mocks.retryOperation.mockResolvedValue(activeDefinitionReceipt);
    render(<MemoryRouter><GatewayToolPublicationDialog open hostId="host-a" tools={tools} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('Gateway A');
    fireEvent.click(screen.getByRole('button', {name: 'Preview changes'}));
    expect(await screen.findByText(`Unconfirmed — Retry · ${definitionOperationId}`)).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Retry'})).toHaveLength(1);
    expect(screen.getByText(/Orders: WORKFLOW_OPERATION_UNCONFIRMED/)).toBeInTheDocument();
    expect(screen.getByText(/Returns: WORKFLOW_OPERATION_UNCONFIRMED/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    await waitFor(() => expect(mocks.retryOperation).toHaveBeenCalledExactlyOnceWith('host-a', definitionOperationId));
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    expect(screen.getByText(/Orders: WORKFLOW_OPERATION_UNCONFIRMED/)).toBeInTheDocument();
    expect(screen.getByText(/Returns: WORKFLOW_OPERATION_UNCONFIRMED/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Refresh batch status'}));
    await waitFor(() => expect(mocks.refreshBindings).toHaveBeenCalledWith('host-a', ['tool-a', 'tool-b']));
    expect(mocks.publishBindings).toHaveBeenCalledTimes(1);
  });
  for (const code of ['ERR11000', 'WORKFLOW_INPUT_INVALID', 'VERSION_CONFLICT']) {
    it(`shows a definite ${code} batch rejection as failed and permits a corrected attempt`, async () => {
      mocks.publishBindings.mockRejectedValueOnce({code, message: 'Invalid Tool IDs'});
      render(<MemoryRouter><GatewayToolPublicationDialog open hostId="host-a" tools={tools} onClose={vi.fn()} /></MemoryRouter>);
      await screen.findByText('Gateway A');
      fireEvent.click(screen.getByRole('button', {name: 'Preview changes'}));
      expect(await screen.findByText(`Orders: ${code}: Invalid Tool IDs`)).toBeInTheDocument();
      expect(screen.getByText(`Returns: ${code}: Invalid Tool IDs`)).toBeInTheDocument();
      expect(screen.queryByText(/Batch Workflow Tool publication outcome is unconfirmed/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', {name: 'Preview changes'}));
      await waitFor(() => expect(mocks.publishBindings).toHaveBeenCalledTimes(2));
    });
  }
  it('continues Tool publication explicitly after recovering only the prerequisite definition', async () => {
    mocks.publishBindings.mockResolvedValueOnce({results: [{toolId: 'tool-a', status: 'unconfirmed',
      code: 'WORKFLOW_OPERATION_UNCONFIRMED', operationId: definitionOperationId}]})
      .mockResolvedValueOnce({results: [{toolId: 'tool-a', status: 'active'}]});
    mocks.retryOperation.mockResolvedValue(activeDefinitionReceipt);
    render(<MemoryRouter><GatewayToolPublicationDialog open hostId="host-a" tools={[tools[0]]} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('Gateway A');
    fireEvent.click(screen.getByRole('button', {name: 'Preview changes'}));
    await screen.findByText(`Unconfirmed — Retry · ${definitionOperationId}`);
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByText('Orders: Definition published; Tool binding publication still required')).toBeInTheDocument();
    expect(screen.queryByText('Orders: Published')).not.toBeInTheDocument();
    expect(mocks.publishBindings).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', {name: 'Preview changes'}));
    await waitFor(() => expect(mocks.publishBindings).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', {name: 'Continue Tool binding publication'}));
    await waitFor(() => expect(mocks.publishBindings).toHaveBeenCalledWith('host-a', ['tool-a']));
    expect(await screen.findByText('Orders: Published')).toBeInTheDocument();
  });
  it('requires explicit continuation after recovering an unchanged active definition', async () => {
    mocks.publishBindings.mockResolvedValueOnce({results: [{toolId: 'tool-a', status: 'unconfirmed',
      code: 'WORKFLOW_OPERATION_UNCONFIRMED', operationId: definitionOperationId}]})
      .mockResolvedValueOnce({results: [{toolId: 'tool-a', status: 'active'}]});
    mocks.retryOperation.mockResolvedValue({...activeDefinitionReceipt, result: 'unchanged'});
    render(<MemoryRouter><GatewayToolPublicationDialog open hostId="host-a" tools={[tools[0]]} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('Gateway A');
    fireEvent.click(screen.getByRole('button', {name: 'Preview changes'}));
    await screen.findByText(`Unconfirmed — Retry · ${definitionOperationId}`);
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByText('Orders: Definition published; Tool binding publication still required')).toBeInTheDocument();
    expect(mocks.publishBindings).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', {name: 'Continue Tool binding publication'}));
    await waitFor(() => expect(mocks.publishBindings).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Orders: Published')).toBeInTheDocument();
  });
  it('does not continue Tool publication after recovering a retired definition', async () => {
    mocks.publishBindings.mockResolvedValue({results: [{toolId: 'tool-a', status: 'unconfirmed',
      code: 'WORKFLOW_OPERATION_UNCONFIRMED', operationId: definitionOperationId}]});
    mocks.retryOperation.mockResolvedValue({result: 'unchanged', status: 'retired', wfDefId: 'definition-a'});
    render(<MemoryRouter><GatewayToolPublicationDialog open hostId="host-a" tools={[tools[0]]} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('Gateway A');
    fireEvent.click(screen.getByRole('button', {name: 'Preview changes'}));
    await screen.findByText(`Unconfirmed — Retry · ${definitionOperationId}`);
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByText(/Workflow definition is retired; publish an active version/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Continue Tool binding publication'})).not.toBeInTheDocument();
    expect(mocks.publishBindings).toHaveBeenCalledTimes(1);
  });
  it('shows direct retired-definition publication without a binding continuation', async () => {
    mocks.publishBindings.mockResolvedValue({results: [{toolId: 'tool-a', status: 'failed',
      code: 'WORKFLOW_DEFINITION_RETIRED', message: 'Definition version is retired'}]});
    render(<MemoryRouter><GatewayToolPublicationDialog open hostId="host-a" tools={[tools[0]]} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('Gateway A');
    fireEvent.click(screen.getByRole('button', {name: 'Preview changes'}));
    expect(await screen.findByText(/Workflow definition is retired; publish an active version/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Continue Tool binding publication'})).not.toBeInTheDocument();
    expect(mocks.publishBindings).toHaveBeenCalledTimes(1);
  });
  it('shows retirement failure after Gateway staging and retries its original operation', async () => {
    mocks.apiPost.mockResolvedValue({data: {retirementResults: [{toolId: 'tool-a', status: 'unconfirmed',
      code: 'WORKFLOW_OPERATION_UNCONFIRMED', message: 'Remote outcome unknown', operationId: retireOperationId},
    {toolId: 'tool-b', status: 'failed', code: 'WORKFLOW_RETIRE_FAILED', message: 'Binding unavailable'}]}});
    mocks.retryOperation.mockResolvedValue({result: 'retired', toolId: 'tool-a', bindingId: 'revision-a'});
    render(<MemoryRouter><GatewayToolPublicationDialog open hostId="host-a" tools={tools} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('Gateway A');
    fireEvent.click(screen.getByRole('button', {name: 'Preview workflow Tool unpublish'}));
    await screen.findByText(/Review the exact Tool and access-control removals/);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name: 'Stage unpublish'}));
    expect(await screen.findByText('Orders: WORKFLOW_OPERATION_UNCONFIRMED: Remote outcome unknown')).toBeInTheDocument();
    expect(screen.getByText('Returns: WORKFLOW_RETIRE_FAILED: Binding unavailable')).toBeInTheDocument();
    expect(screen.getByText(`Unconfirmed — Retry · ${retireOperationId}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    await waitFor(() => expect(mocks.retryOperation).toHaveBeenCalledWith('host-a', retireOperationId));
    expect(await screen.findByText('Orders: Workflow binding retired')).toBeInTheDocument();
    expect(mocks.apiPost).toHaveBeenCalledTimes(1);
  });
  it('refreshes the Workflow head before deliberately starting a new retirement operation', async () => {
    mocks.apiPost.mockResolvedValue({data: {retirementResults: [{toolId: 'tool-a', status: 'failed',
      code: 'WORKFLOW_OPERATION_EXPIRED', operationId: expiredOperationId}]}});
    render(<MemoryRouter><GatewayToolPublicationDialog open hostId="host-a" tools={[tools[0]]} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('Gateway A');
    fireEvent.click(screen.getByRole('button', {name: 'Preview workflow Tool unpublish'}));
    await screen.findByText(/Review the exact Tool and access-control removals/);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name: 'Stage unpublish'}));
    expect(await screen.findByText(/Refresh status before starting a new retirement operation/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Refresh status'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retire as new operation'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Refresh status'}));
    expect(await screen.findByRole('button', {name: 'Retire as new operation'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Retire as new operation'}));
    await waitFor(() => expect(mocks.retireBinding).toHaveBeenCalledWith('host-a', 'instance-a', 'tool-a', 4));
    expect(await screen.findByText('Orders: Workflow binding retired')).toBeInTheDocument();
    expect(mocks.retryOperation).not.toHaveBeenCalled();
  });
  it('keeps expired retirement visible when the refreshed head conflicts, without resubmitting', async () => {
    mocks.apiPost.mockResolvedValue({data: {retirementResults: [{toolId: 'tool-a', status: 'failed',
      code: 'WORKFLOW_OPERATION_EXPIRED', operationId: expiredOperationId}]}});
    mocks.retireBinding.mockRejectedValue({code: 'VERSION_CONFLICT', message: 'Workflow Tool head changed'});
    render(<MemoryRouter><GatewayToolPublicationDialog open hostId="host-a" tools={[tools[0]]} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('Gateway A');
    fireEvent.click(screen.getByRole('button', {name: 'Preview workflow Tool unpublish'}));
    await screen.findByText(/Review the exact Tool and access-control removals/);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name: 'Stage unpublish'}));
    await screen.findByText(/Expired; remote outcome unconfirmed/);
    fireEvent.click(screen.getByRole('button', {name: 'Refresh status'}));
    fireEvent.click(await screen.findByRole('button', {name: 'Retire as new operation'}));
    expect(await screen.findByText(/VERSION_CONFLICT: Workflow Tool head changed/)).toBeInTheDocument();
    expect(screen.getByText('Expired; remote outcome unconfirmed')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retire as new operation'})).not.toBeInTheDocument();
    expect(mocks.retireBinding).toHaveBeenCalledTimes(1);
  });
  it('recovers a new retirement timeout only through RetryWorkflowOperation', async () => {
    mocks.apiPost.mockResolvedValue({data: {retirementResults: [{toolId: 'tool-a', status: 'failed',
      code: 'WORKFLOW_OPERATION_EXPIRED', operationId: expiredOperationId}]}});
    mocks.retireBinding.mockRejectedValue({code: 'WORKFLOW_OPERATION_UNCONFIRMED',
      metadata: {details: {operationId: newRetireOperationId}}, message: 'Remote outcome unknown'});
    mocks.retryOperation.mockResolvedValue({result: 'retired', bindingId: 'revision-a'});
    render(<MemoryRouter><GatewayToolPublicationDialog open hostId="host-a" tools={[tools[0]]} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('Gateway A');
    fireEvent.click(screen.getByRole('button', {name: 'Preview workflow Tool unpublish'}));
    await screen.findByText(/Review the exact Tool and access-control removals/);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name: 'Stage unpublish'}));
    await screen.findByText(/Expired; remote outcome unconfirmed/);
    fireEvent.click(screen.getByRole('button', {name: 'Refresh status'}));
    fireEvent.click(await screen.findByRole('button', {name: 'Retire as new operation'}));
    expect(await screen.findByText(`Unconfirmed — Retry · ${newRetireOperationId}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    await waitFor(() => expect(mocks.retryOperation).toHaveBeenCalledWith('host-a', newRetireOperationId));
    expect(await screen.findByText('Orders: Workflow binding retired')).toBeInTheDocument();
    expect(mocks.retireBinding).toHaveBeenCalledTimes(1);
    expect(mocks.apiPost).toHaveBeenCalledTimes(1);
  });
  it('keeps an expired operation visible when Refresh finds the binding already retired', async () => {
    mocks.apiPost.mockResolvedValue({data: {retirementResults: [{toolId: 'tool-a', status: 'failed',
      code: 'WORKFLOW_OPERATION_EXPIRED', operationId: expiredOperationId}]}});
    mocks.getBindingForTool.mockResolvedValue({aggregateVersion: 5, revision: {revisionStatus: 'retired'}});
    render(<MemoryRouter><GatewayToolPublicationDialog open hostId="host-a" tools={[tools[0]]} onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText('Gateway A');
    fireEvent.click(screen.getByRole('button', {name: 'Preview workflow Tool unpublish'}));
    await screen.findByText(/Review the exact Tool and access-control removals/);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name: 'Stage unpublish'}));
    await screen.findByText(/Expired; remote outcome unconfirmed/);
    fireEvent.click(screen.getByRole('button', {name: 'Refresh status'}));
    expect(await screen.findByText(/Workflow currently reports this binding retired/)).toBeInTheDocument();
    expect(screen.getByText('Expired; remote outcome unconfirmed')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retire as new operation'})).not.toBeInTheDocument();
  });
});
