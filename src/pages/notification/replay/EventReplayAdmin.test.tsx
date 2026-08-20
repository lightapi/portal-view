import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      notificationIdentities={[]} onProjectionRefresh={onProjectionRefresh} />);
    await waitFor(() => expect(onProjectionRefresh).toHaveBeenCalledOnce());
    expect(observed).toEqual([{ hostId: 'host-1', replayRequestId: 'replay-1', repairId: null }]);
    expect(replayApi.listCandidates).toHaveBeenCalled();
    window.removeEventListener('portal:event-replay-applied', listener);
  });

  it.each([
    ['REPLAY_EXECUTION_UNAVAILABLE', 'RUNNING', false],
    ['REQUEST_FAILED', 'RUNNING', false],
    ['REQUEST_FAILED', 'APPROVED', true],
  ])('handles %s with durable %s', async (transportCode, durableStatus, errorVisible) => {
    const approved = {
      replayRequestId: 'replay-1', hostId: 'host-1', projectionName: 'portal-query',
      consumerGroup: 'user-query-group', strategy: 'EXACT', validationMode: 'EXECUTE', reason: 'repair',
      planHash: `sha256:${'1'.repeat(64)}`, status: 'APPROVED', transactionCount: 1, eventCount: 1,
      encryptedPayloadBytes: 0, decryptedPayloadBytes: 0, requestedBy: 'requester', approvedBy: 'approver',
      requestedTs: '2026-07-24T12:00:00Z', approvedTs: '2026-07-24T12:00:30Z',
      expiresAt: '2026-07-24T13:00:00Z', projectionCommitted: false, stale: false,
      items: [], attempts: [], barriers: [], deferred: { count: 0, encryptedBytes: 0 },
    };
    localStorage.setItem('event-replay:last-request:host-1', 'replay-1');
    vi.mocked(replayApi.getReplay).mockReset()
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce({ ...approved, status: durableStatus, retryable: false });
    vi.mocked(replayApi.execute).mockRejectedValueOnce(
      new Error(`Event replay request failed (${transportCode}).`));

    render(<EventReplayAdmin hostId="host-1" currentUserId="executor" notificationIdentities={[]} />);
    const hash = await screen.findByLabelText('Confirm exact plan hash before execution');
    fireEvent.change(hash, { target: { value: approved.planHash } });
    fireEvent.change(screen.getByLabelText('Action reason'), { target: { value: 'run approved replay' } });
    fireEvent.click(screen.getByLabelText(/I reviewed the immutable plan/));
    fireEvent.click(screen.getByRole('button', { name: 'Execute approved plan' }));

    await waitFor(() => expect(replayApi.execute).toHaveBeenCalledOnce());
    await waitFor(() => expect(replayApi.getReplay).toHaveBeenCalledTimes(2));
    if (errorVisible) {
      expect((await screen.findAllByText(new RegExp(transportCode))).length).toBeGreaterThan(0);
    } else {
      expect(screen.queryByText(new RegExp(transportCode))).toBeNull();
    }
  });

  it('shows a domain failure when a resumable retry is declined', async () => {
    const running = {
      replayRequestId: 'replay-1', hostId: 'host-1', projectionName: 'portal-query',
      consumerGroup: 'user-query-group', strategy: 'EXACT', validationMode: 'EXECUTE', reason: 'repair',
      planHash: `sha256:${'1'.repeat(64)}`, status: 'RUNNING', transactionCount: 1, eventCount: 1,
      encryptedPayloadBytes: 0, decryptedPayloadBytes: 0, requestedBy: 'requester', approvedBy: 'approver',
      requestedTs: '2026-07-24T12:00:00Z', approvedTs: '2026-07-24T12:00:30Z',
      expiresAt: '2026-07-24T13:00:00Z', projectionCommitted: false, stale: false, retryable: true,
      items: [], attempts: [], barriers: [], deferred: { count: 0, encryptedBytes: 0 },
    };
    localStorage.setItem('event-replay:last-request:host-1', 'replay-1');
    vi.mocked(replayApi.getReplay).mockReset().mockResolvedValue(running);
    vi.mocked(replayApi.execute).mockRejectedValueOnce(
      new Error('Event replay request failed (REPLAY_EXECUTION_IN_PROGRESS).'));

    render(<EventReplayAdmin hostId="host-1" currentUserId="executor" notificationIdentities={[]} />);
    fireEvent.change(await screen.findByLabelText('Confirm exact plan hash before execution'),
      { target: { value: running.planHash } });
    fireEvent.change(screen.getByLabelText('Action reason'), { target: { value: 'retry replay' } });
    fireEvent.click(screen.getByLabelText(/I reviewed the immutable plan/));
    const retry = screen.getByRole('button', { name: 'Retry execution' }) as HTMLButtonElement;
    await waitFor(() => expect(retry.disabled).toBe(false));
    fireEvent.click(retry);

    await waitFor(() => expect(replayApi.execute).toHaveBeenCalledOnce());
    expect((await screen.findAllByText(/REPLAY_EXECUTION_IN_PROGRESS/)).length).toBeGreaterThan(0);
  });
});
