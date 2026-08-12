import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReplayCandidateTable } from './ReplayCandidateTable';
import type { ReplayCandidate, ReplayFailure } from './types';

const candidate: ReplayCandidate = {
  failureId: 'failure-1', status: 'OPEN', eventCount: 1, replayPolicy: 'EXACT',
  firstFailedTs: '2026-08-12T12:00:00Z', lastFailedTs: '2026-08-12T12:01:00Z',
  errorCode: 'PROJECTION_HANDLER_FAILED', payloadAvailable: true,
};

const detail: ReplayFailure = {
  ...candidate, hostId: 'host-1', projectionName: 'portal-query', consumerGroup: 'user-query-group',
  originalTransactionId: 'transaction-1', contentFingerprint: 'sha256:abc', dependencyScopes: [],
  userIds: ['user-1'],
  errorType: 'SQLException', errorMessage: 'java.sql.SQLException [SQLState 23505]\n\tat example.Handler.apply(Handler.java:42)',
  events: [{ ordinal: 0, eventId: 'event-1', eventType: 'ConfigCreatedEvent', schemaVersion: '1',
    aggregateId: 'aggregate-1', sourceProcessor: 'DATABASE', payloadAvailable: true }],
};

describe('ReplayCandidateTable diagnostics', () => {
  it('renders event identity, notification user, and expandable failure details', () => {
    const onToggle = vi.fn();
    const { container } = render(<ReplayCandidateTable candidates={[candidate]} details={{ 'failure-1': detail }}
      selected={new Set()} notificationIdentities={[{ transactionId: 'transaction-1', userId: 'user-1' }]}
      onToggle={onToggle} />);

    expect(screen.getByText('ConfigCreatedEvent')).toBeInTheDocument();
    expect(screen.getByText('aggregate-1')).toBeInTheDocument();
    expect(screen.getByText('user-1')).toBeInTheDocument();
    expect(screen.getByText('PROJECTION_HANDLER_FAILED · SQLException')).toBeInTheDocument();
    expect(screen.getByText(/SQLState 23505/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('failure-1');
    expect(container.querySelector('details')).not.toBeNull();
  });
});
