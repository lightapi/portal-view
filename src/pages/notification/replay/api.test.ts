import { beforeEach, describe, expect, it, vi } from 'vitest';
import fetchClient from '../../../utils/fetchClient';
import { replayApi } from './api';

vi.mock('../../../utils/fetchClient', () => ({ default: vi.fn() }));

const request = () => {
  const url = String(vi.mocked(fetchClient).mock.calls.at(-1)?.[0]);
  return JSON.parse(new URL(url, 'https://portal.example').searchParams.get('cmd') || '{}');
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
  });

  it('uses metadata-only get and fingerprint-bound repair decision endpoints', async () => {
    await replayApi.getRepair('host-1', 'repair-1');
    expect(request()).toEqual(expect.objectContaining({ action: 'getEventReplayRepair', data: { hostId: 'host-1', repairId: 'repair-1' } }));
    await replayApi.decideRepair('host-1', 'repair-1', `sha256:${'2'.repeat(64)}`, 'APPROVE', 'reviewed');
    expect(request()).toEqual(expect.objectContaining({ action: 'approveEventReplayRepair', data: expect.objectContaining({
      decision: 'APPROVE', expectedCorrectedTransactionFingerprint: `sha256:${'2'.repeat(64)}`,
    }) }));
  });

  it('binds an approved repair id into a separate replay plan', async () => {
    await replayApi.createPlan('host-1', 'portal-query', 'user-query-group', ['failure-1'],
      'EXACT', 'EXECUTE', 'apply repair', 'repair-1');
    expect(request()).toEqual(expect.objectContaining({ action: 'createEventReplayPlan', data: expect.objectContaining({ repairId: 'repair-1' }) }));
  });

  it('executes only the separately approved immutable plan hash', async () => {
    await replayApi.execute('host-1', 'replay-1', `sha256:${'5'.repeat(64)}`, 'execute approved plan');
    expect(request()).toEqual(expect.objectContaining({ action: 'executeEventReplay', data: {
      hostId: 'host-1', replayRequestId: 'replay-1', planHash: `sha256:${'5'.repeat(64)}`,
      reason: 'execute approved plan',
    } }));
  });

  it('surfaces only allowlisted public result codes from legacy error envelopes', async () => {
    vi.mocked(fetchClient).mockRejectedValueOnce({ code: 'ERR11000', description: 'failure: EVENT_REPAIR_REQUIRED internal detail' });
    await expect(replayApi.createPlan('host-1', 'portal-query', 'user-query-group', ['failure-1'],
      'EXACT', 'EXECUTE', 'retry')).rejects.toThrow(/EVENT_REPAIR_REQUIRED.*Create and approve a repair/);
    vi.mocked(fetchClient).mockRejectedValueOnce({ description: 'database host secret' });
    await expect(replayApi.getRepair('host-1', 'repair-1')).rejects.not.toThrow(/database host secret/);
  });
});
