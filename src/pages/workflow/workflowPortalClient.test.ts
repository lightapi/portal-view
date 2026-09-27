import {beforeEach, describe, expect, it, vi} from 'vitest';
const mocks = vi.hoisted(() => ({apiPost: vi.fn()}));
vi.mock('../../api/apiPost', () => ({apiPost: mocks.apiPost}));
import {portalError, workflowPortalClient} from './workflowPortalClient';

beforeEach(() => { mocks.apiPost.mockReset().mockResolvedValue({data: {accepted: true}}); });

describe('Portal Workflow commands', () => {
  it('routes manual sync through the authenticated Portal command', async () => {
    await workflowPortalClient.sync('host', 'definition');
    expect(mocks.apiPost.mock.calls[0][0].body).toMatchObject({
      service: 'workflow', action: 'syncWfDefinition',
      data: {hostId: 'host', wfDefId: 'definition'},
    });
  });
  it('uses Portal for Start with the body key', async () => {
    await workflowPortalClient.start('host', 'definition', {value: 1}, 'same-key');
    expect(mocks.apiPost).toHaveBeenCalledWith(expect.objectContaining({url: '/portal/command', body: {
      host: 'lightapi.net', service: 'workflow', action: 'startWorkflow', version: '0.1.0',
      data: {hostId: 'host', wfDefId: 'definition', input: {value: 1}, idempotencyKey: 'same-key'},
    }}));
  });
  it('does not fall back to Gateway on a synchronization failure', async () => {
    mocks.apiPost.mockResolvedValue({error: {code: 'WORKFLOW_SYNC_REVISION_CONFLICT', message: 'Investigate', details: {appliedRevision: 8}}});
    await expect(workflowPortalClient.start('host', 'definition', {}, 'same-key'))
      .rejects.toThrow('WORKFLOW_SYNC_REVISION_CONFLICT: Investigate');
    expect(mocks.apiPost).toHaveBeenCalledTimes(1);
  });
  it('keeps nested D21 operation metadata and sends Retry only by operation ID', async () => {
    const failure = portalError({statusCode: 502, code: 'WORKFLOW_OPERATION_PENDING',
      message: 'WORKFLOW_OPERATION_PENDING', description: 'Workflow operation is pending',
      metadata: {details: {operationId: 'operation', requestedBy: 'someone', requestedTs: '2026-09-26T00:00:00Z'}}});
    expect(failure).toMatchObject({operationId: 'operation', requestedBy: 'someone'});
    expect(failure.message).toBe('WORKFLOW_OPERATION_PENDING: Workflow operation is pending');
    await workflowPortalClient.retryOperation('host', 'operation');
    expect(mocks.apiPost.mock.calls[0][0].body).toMatchObject({action: 'retryWorkflowOperation',
      data: {hostId: 'host', operationId: 'operation'}});
  });
  it('starts deliberate retirement with the selected Gateway and caller-read Workflow head', async () => {
    await workflowPortalClient.retireBinding('host', 'gateway', 'tool', 4);
    expect(mocks.apiPost).toHaveBeenCalledWith(expect.objectContaining({url: '/portal/command', body: {
      host: 'lightapi.net', service: 'genai', action: 'retireWorkflowToolBinding', version: '0.1.0',
      data: {hostId: 'host', instanceId: 'gateway', toolId: 'tool', expectedAggregateVersion: 4},
    }}));
  });
});
