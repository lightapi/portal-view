import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReplayRepairPanel } from './ReplayRepairPanel';
import type { ReplayFailure, ReplayRepair } from './types';

vi.mock('react-schema-form', () => ({
  SchemaForm: ({ model, onModelChange }: { model: Record<string, unknown>; onModelChange: (key: string, value: string) => void }) =>
    <input aria-label="First Name" value={String(model.firstName || '')}
      onChange={(event) => onModelChange('firstName', event.target.value)} />,
  utils: {
    selectOrSet: (key: string, model: Record<string, unknown>, value: unknown) => { model[key] = value; },
    validateBySchema: (_schema: unknown, model: Record<string, unknown>) => ({ valid: !!String(model.firstName || '').trim() }),
  },
}));

const failure: ReplayFailure = {
  failureId: 'failure-1', hostId: 'host-1', status: 'OPEN', eventCount: 1,
  replayPolicy: 'AGGREGATE_VERSION', firstFailedTs: '2026-07-24T12:00:00Z', lastFailedTs: '2026-07-24T12:00:00Z',
  payloadAvailable: true, projectionName: 'portal-query', consumerGroup: 'user-query-group',
  contentFingerprint: `sha256:${'1'.repeat(64)}`, dependencyScopes: [],
  events: [{ ordinal: 0, eventId: 'event-1', eventType: 'UserUpdatedEvent', schemaVersion: '1', payloadAvailable: true }],
};

const repair: ReplayRepair = {
  repairId: 'repair-1', failureId: failure.failureId, status: 'AWAITING_APPROVAL', reason: 'fix data',
  repairSchemaVersion: 'user-updated-repair-v1', changedFieldNames: ['firstName'],
  originalTransactionFingerprint: `sha256:${'1'.repeat(64)}`,
  correctedTransactionFingerprint: `sha256:${'2'.repeat(64)}`,
  requesterUserId: 'requester', requestedTs: '2026-07-24T12:00:00Z',
  events: [{ ordinal: 0, eventId: 'event-1', originalPayloadDigest: `sha256:${'3'.repeat(64)}`,
    correctedPayloadDigest: `sha256:${'4'.repeat(64)}`, changedFieldNames: ['firstName'] }],
};

const callbacks = () => ({ onCreate: vi.fn(), onDecision: vi.fn(), onPlan: vi.fn(), onClose: vi.fn() });

describe('ReplayRepairPanel', () => {
  it('validates and creates the explicit single-event change shape from Forms.json', () => {
    const handlers = callbacks();
    render(<ReplayRepairPanel failure={failure} repair={null} currentUserId="requester" busy={false} {...handlers} />);
    fireEvent.change(screen.getByLabelText('Repair reason'), { target: { value: 'correct invalid data' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create repair proposal' }));
    expect(screen.getByText(/Complete every required repair field/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Corrected name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create repair proposal' }));
    expect(handlers.onCreate).toHaveBeenCalledWith({
      repairSchemaVersion: 'user-updated-repair-v1',
      changeShape: 'SINGLE_EVENT_FIELDS', changes: { firstName: 'Corrected name' }, reason: 'correct invalid data',
    });
  });

  it('keeps repair approval separate and requires a different displayed identity', () => {
    const handlers = callbacks();
    const view = render(<ReplayRepairPanel failure={failure} repair={repair} currentUserId="requester" busy={false} {...handlers} />);
    fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'reviewed fields' } });
    expect(screen.getByRole('button', { name: 'Approve repair' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject repair' })).toBeDisabled();
    view.rerender(<ReplayRepairPanel failure={failure} repair={repair} currentUserId="approver" busy={false} {...handlers} />);
    fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'reviewed fields' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve repair' }));
    expect(handlers.onDecision).toHaveBeenCalledWith('APPROVE', 'reviewed fields');
  });

  it('uses per-event changes for multiple matching members and explains the unchanged subset', () => {
    const handlers = callbacks();
    const multi = { ...failure, eventCount: 3, events: [failure.events[0],
      { ...failure.events[0], ordinal: 1, eventId: 'event-2' },
      { ...failure.events[0], ordinal: 2, eventId: 'unchanged', eventType: 'UnrepairableEvent' }] };
    render(<ReplayRepairPanel failure={multi} repair={null} currentUserId="requester" busy={false} {...handlers} />);
    const fields = screen.getAllByLabelText('First Name');
    fireEvent.change(fields[0], { target: { value: 'First corrected' } });
    fireEvent.change(fields[1], { target: { value: 'Second corrected' } });
    fireEvent.change(screen.getByLabelText('Repair reason'), { target: { value: 'repair matching members' } });
    expect(screen.getByText(/2 member\(s\).*editable.*other 1 transaction member/s)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create repair proposal' }));
    expect(handlers.onCreate).toHaveBeenCalledWith(expect.objectContaining({
      changeShape: 'PER_EVENT_FIELDS',
      changes: { 'event-1': { firstName: 'First corrected' }, 'event-2': { firstName: 'Second corrected' } },
    }));
  });

  it('routes an unavailable form to Replay original', () => {
    const unsupported = { ...failure, events: [{ ...failure.events[0], eventType: 'UnsupportedEvent' }] };
    render(<ReplayRepairPanel failure={unsupported} repair={null} currentUserId="requester" busy={false} {...callbacks()} />);
    expect(screen.getByText(/No single unambiguous repair form/)).toHaveTextContent('use Replay original instead');
    expect(screen.queryByRole('button', { name: 'Create repair proposal' })).not.toBeInTheDocument();
  });

  it('shows metadata without values and clears corrected form state after creation', async () => {
    const handlers = callbacks();
    const view = render(<ReplayRepairPanel failure={failure} repair={null} currentUserId="requester" busy={false} {...handlers} />);
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Sensitive corrected value' } });
    fireEvent.change(screen.getByLabelText('Repair reason'), { target: { value: 'repair' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create repair proposal' }));
    view.rerender(<ReplayRepairPanel failure={failure} repair={repair} currentUserId="approver" busy={false} {...handlers} />);
    await waitFor(() => expect(screen.queryByDisplayValue('Sensitive corrected value')).not.toBeInTheDocument());
    expect(screen.getByText(repair.originalTransactionFingerprint)).toBeInTheDocument();
    expect(screen.getByText(repair.correctedTransactionFingerprint)).toBeInTheDocument();
    expect(screen.getByText(repair.events[0].originalPayloadDigest)).toBeInTheDocument();
    expect(screen.getByText(repair.events[0].correctedPayloadDigest)).toBeInTheDocument();
    view.rerender(<ReplayRepairPanel failure={failure} repair={null} currentUserId="approver" busy={false} {...handlers} />);
    await waitFor(() => expect(screen.getByLabelText('First Name')).toHaveValue(''));
  });

  it('plans only an approved repair and clearly stops a stale repair', () => {
    const handlers = callbacks();
    const view = render(<ReplayRepairPanel failure={failure} repair={{ ...repair, status: 'APPROVED' }}
      currentUserId="approver" busy={false} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: 'Plan approved repair' }));
    expect(handlers.onPlan).toHaveBeenCalledOnce();
    view.rerender(<ReplayRepairPanel failure={failure} repair={{ ...repair, status: 'CANCELLED' }}
      currentUserId="approver" busy={false} {...handlers} />);
    expect(screen.getByText(/cannot be planned/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Plan approved repair' })).not.toBeInTheDocument();
  });
});
