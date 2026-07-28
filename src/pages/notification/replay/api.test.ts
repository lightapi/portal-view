import { beforeEach, describe, expect, it, vi } from 'vitest';
import fetchClient from '../../../utils/fetchClient';
import { replayApi } from './api';

vi.mock('../../../utils/fetchClient', () => ({ default: vi.fn() }));

const requestOptions = () => vi.mocked(fetchClient).mock.calls.at(-1)?.[1];
const requestUrl = () => new URL(String(vi.mocked(fetchClient).mock.calls.at(-1)?.[0]), 'https://portal.example');
const request = () => {
  const command = requestUrl().searchParams.get('cmd');
  return command ? JSON.parse(command) : requestOptions()?.body;
};
const requestPath = () => requestUrl().pathname;
const expectQueryRequest = () => {
  expect(requestPath()).toBe('/portal/query');
  expect(requestOptions()).toBeUndefined();
};
const expectCommandRequest = () => {
  expect(requestPath()).toBe('/portal/command');
  expect(requestUrl().search).toBe('');
  expect(requestOptions()).toEqual(expect.objectContaining({ method: 'POST' }));
};

describe('replay repair API', () => {
  beforeEach(() => vi.mocked(fetchClient).mockResolvedValue({ repairId: 'repair-1' }));

  it('sends the required changeShape and immutable fingerprint when creating a repair', async () => {
    await replayApi.createRepair('host-1', 'failure-1', `sha256:${'1'.repeat(64)}`,
      'event-replay-contract-fixture-repair-v1', 'SINGLE_EVENT_FIELDS', { displayName: 'Corrected' }, 'reason');
    expect(request()).toEqual(expect.objectContaining({ action: 'createEventReplayRepair', data: expect.objectContaining({
      changeShape: 'SINGLE_EVENT_FIELDS', changes: { displayName: 'Corrected' },
      expectedOriginalTransactionFingerprint: `sha256:${'1'.repeat(64)}`,
    }) }));
    expectCommandRequest();
  });

  it('uses metadata-only get and fingerprint-bound repair decision endpoints', async () => {
    await replayApi.getRepair('host-1', 'repair-1');
    expect(request()).toEqual(expect.objectContaining({ action: 'getEventReplayRepair', data: { hostId: 'host-1', repairId: 'repair-1' } }));
    expectQueryRequest();
    await replayApi.decideRepair('host-1', 'repair-1', `sha256:${'2'.repeat(64)}`, 'APPROVE', 'reviewed');
    expect(request()).toEqual(expect.objectContaining({ action: 'approveEventReplayRepair', data: expect.objectContaining({
      decision: 'APPROVE', expectedCorrectedTransactionFingerprint: `sha256:${'2'.repeat(64)}`,
    }) }));
    expectCommandRequest();
  });

  it('binds an approved repair id into a separate replay plan', async () => {
    await replayApi.createPlan('host-1', 'portal-query', 'user-query-group', ['failure-1'],
      'EXACT', 'EXECUTE', 'apply repair', 'repair-1');
    expect(request()).toEqual(expect.objectContaining({ action: 'createEventReplayPlan', data: expect.objectContaining({ repairId: 'repair-1' }) }));
    expectCommandRequest();
  });

  it('executes only the separately approved immutable plan hash', async () => {
    await replayApi.execute('host-1', 'replay-1', `sha256:${'5'.repeat(64)}`, 'execute approved plan');
    expect(request()).toEqual(expect.objectContaining({ action: 'executeEventReplay', data: {
      hostId: 'host-1', replayRequestId: 'replay-1', planHash: `sha256:${'5'.repeat(64)}`,
      reason: 'execute approved plan',
    } }));
    expectCommandRequest();
  });

  it('keeps replay reads on query and routes every mutation to command', async () => {
    await replayApi.listCandidates('host-1', 'portal-query', 'user-query-group', 0, 25);
    expectQueryRequest();
    await replayApi.getFailure('host-1', 'failure-1');
    expectQueryRequest();
    await replayApi.getReplay('host-1', 'replay-1');
    expectQueryRequest();

    await replayApi.approve('host-1', 'replay-1', `sha256:${'3'.repeat(64)}`, 'approve');
    expectCommandRequest();
    await replayApi.cancel('host-1', 'replay-1', `sha256:${'4'.repeat(64)}`, 'cancel');
    expectCommandRequest();
    await replayApi.requestWaiver('host-1', ['failure-1'], 'waive');
    expect(request()).toEqual(expect.objectContaining({ action: 'waiveEventReplayFailure', data: {
      hostId: 'host-1', failureIds: ['failure-1'], expectedStatuses: ['OPEN'],
      acknowledgeDependencyImpact: true, reason: 'waive',
    } }));
    expectCommandRequest();
    await replayApi.approveWaiver('host-1', 'waiver-1', ['failure-1'], [], 'approve waiver');
    expect(request()).toEqual(expect.objectContaining({ action: 'waiveEventReplayFailure', data: {
      hostId: 'host-1', waiverRequestId: 'waiver-1', failureIds: ['failure-1'],
      expectedDownstreamBlockedFailureIds: [], reason: 'approve waiver',
    } }));
    expectCommandRequest();
    await replayApi.requestBarrierRelease('host-1', 'barrier-1', 1, 'failure-1', 'release');
    expect(request()).toEqual(expect.objectContaining({ action: 'releaseEventReplayBarrier', data: {
      hostId: 'host-1', barrierId: 'barrier-1', expectedEpoch: 1, owningFailureId: 'failure-1',
      action: 'RELEASE_WITH_GAP', reason: 'release',
    } }));
    expectCommandRequest();
    await replayApi.approveBarrierRelease('host-1', 'action-1', 'approve release');
    expect(request()).toEqual(expect.objectContaining({ action: 'releaseEventReplayBarrier', data: {
      hostId: 'host-1', actionRequestId: 'action-1', reason: 'approve release',
    } }));
    expectCommandRequest();
  });

  it('surfaces only allowlisted public result codes from legacy error envelopes', async () => {
    vi.mocked(fetchClient).mockRejectedValueOnce({ code: 'ERR11000', description: 'failure: EVENT_REPAIR_REQUIRED internal detail' });
    await expect(replayApi.createPlan('host-1', 'portal-query', 'user-query-group', ['failure-1'],
      'EXACT', 'EXECUTE', 'retry')).rejects.toThrow(/EVENT_REPAIR_REQUIRED.*Create and approve a repair/);
    vi.mocked(fetchClient).mockRejectedValueOnce({ code: -32603, message: 'Replay command failed', data: 'EVENT_REPAIR_REQUIRED' });
    await expect(replayApi.createPlan('host-1', 'portal-query', 'user-query-group', ['failure-1'],
      'EXACT', 'EXECUTE', 'retry')).rejects.toThrow(/EVENT_REPAIR_REQUIRED.*Create and approve a repair/);
    vi.mocked(fetchClient).mockRejectedValueOnce({ description: 'database host secret' });
    await expect(replayApi.getRepair('host-1', 'repair-1')).rejects.not.toThrow(/database host secret/);
  });
});
