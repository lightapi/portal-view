import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventReplayAdmin } from './EventReplayAdmin';
import { replayApi } from './api';

vi.mock('./api', () => ({ replayApi: {
  listCandidates: vi.fn(), getFailure: vi.fn(), getReplay: vi.fn(), getRepair: vi.fn(),
  createPlan: vi.fn(), createRepair: vi.fn(), decideRepair: vi.fn(), approve: vi.fn(),
  execute: vi.fn(), cancel: vi.fn(), requestWaiver: vi.fn(), approveWaiver: vi.fn(),
  requestBarrierRelease: vi.fn(), approveBarrierRelease: vi.fn(),
} }));

describe('EventReplayAdmin committed refresh', () => {
  beforeEach(() => {
    localStorage.clear(); window.history.replaceState({}, '', '/app/event/notifications');
    vi.mocked(replayApi.listCandidates).mockResolvedValue({ page: 0, pageSize: 25, total: 0, items: [] });
    vi.mocked(replayApi.getReplay).mockResolvedValue({
      replayRequestId: 'replay-1', hostId: 'host-1', projectionName: 'portal-query',
      consumerGroup: 'user-query-group', strategy: 'EXACT', validationMode: 'EXECUTE', reason: 'repair',
      planHash: `sha256:${'1'.repeat(64)}`, status: 'SUCCEEDED', transactionCount: 1, eventCount: 1,
      encryptedPayloadBytes: 0, decryptedPayloadBytes: 0, requestedBy: 'requester',
      requestedTs: '2026-07-24T12:00:00Z', completedTs: '2026-07-24T12:01:00Z',
      expiresAt: '2026-07-24T13:00:00Z', projectionCommitted: true, stale: false,
      items: [{ ordinal: 0, failureId: 'failure-1', expectedContentFingerprint: `sha256:${'2'.repeat(64)}`,
        dependencyReason: 'selected', addedDependency: false, status: 'SUCCEEDED', attemptCount: 1 }],
      attempts: [], barriers: [], deferred: { count: 0, encryptedBytes: 0 },
    });
  });

  it('refreshes host data and emits only metadata after committed success', async () => {
    localStorage.setItem('event-replay:last-request:host-1', 'replay-1');
    const onProjectionRefresh = vi.fn();
    const observed: unknown[] = [];
    const listener = (event: Event) => observed.push((event as CustomEvent).detail);
    window.addEventListener('portal:event-replay-applied', listener);
    render(<EventReplayAdmin hostId="host-1" currentUserId="approver"
      notificationTransactionIds={[]} onProjectionRefresh={onProjectionRefresh} />);
    await waitFor(() => expect(onProjectionRefresh).toHaveBeenCalledOnce());
    expect(observed).toEqual([{ hostId: 'host-1', replayRequestId: 'replay-1', repairId: null }]);
    expect(replayApi.listCandidates).toHaveBeenCalled();
    window.removeEventListener('portal:event-replay-applied', listener);
  });
});
