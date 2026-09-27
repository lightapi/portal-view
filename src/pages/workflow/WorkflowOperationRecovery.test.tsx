import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
const mocks = vi.hoisted(() => ({retryOperation: vi.fn(), refreshBindings: vi.fn()}));
vi.mock('../../contexts/UserContext', () => ({useUserState: () => ({userId: 'requester-a'})}));
vi.mock('./workflowPortalClient', async importOriginal => {
  const original = await importOriginal<typeof import('./workflowPortalClient')>();
  return {...original, workflowPortalClient: {retryOperation: mocks.retryOperation,
    refreshBindings: mocks.refreshBindings}};
});
import WorkflowOperationRecovery, {operationState} from './WorkflowOperationRecovery';
import {portalError} from './workflowPortalClient';

const operationId = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {mocks.retryOperation.mockReset().mockResolvedValue({revisionStatus: 'approved'});});

function show(operation: ReturnType<typeof operationState>) {
  const onRecovered = vi.fn(), onRefresh = vi.fn(), onNew = vi.fn();
  render(<WorkflowOperationRecovery hostId="host-a" operation={operation} onRecovered={onRecovered}
    onRefresh={onRefresh} onNew={onNew} newLabel="Publish as new operation" />);
  return {onRecovered, onRefresh, onNew};
}

describe('D21 recovery controls', () => {
  it('sends only RetryWorkflowOperation for the original user and preserves the operation ID', async () => {
    const callbacks = show(operationState({code: 'WORKFLOW_OPERATION_UNCONFIRMED',
      details: {operationId}}));
    expect(screen.getByText(`Unconfirmed — Retry · ${operationId}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    await waitFor(() => expect(mocks.retryOperation).toHaveBeenCalledWith('host-a', operationId));
    expect(callbacks.onRecovered).toHaveBeenCalledWith({revisionStatus: 'approved'});
    expect(callbacks.onNew).not.toHaveBeenCalled();
  });
  it('shows the other requester and has no Retry', () => {
    show(operationState({statusCode: 502, code: 'WORKFLOW_OPERATION_PENDING',
      metadata: {details: {operationId, requestedBy: 'other-user',
        requestedTs: '2026-09-26T00:00:00Z'}}}));
    expect(screen.getByText(/Pending, requested by other-user at 2026-09-26T00:00:00Z/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
  });
  it('rejects malformed top-level and nested recovery metadata without offering Retry', () => {
    const operation = operationState({code: 'WORKFLOW_OPERATION_UNCONFIRMED',
      operationId: 'bad-top-level', requestedBy: 42, requestedTs: 'invalid',
      details: {operationId: 'not-a-uuid', requestedBy: ' ', requestedTs: '2026-02-30T00:00:00Z'}});
    expect(operation).toEqual({code: 'WORKFLOW_OPERATION_UNCONFIRMED', message: undefined,
      operationId: undefined, requestedBy: undefined, requestedTs: undefined,
      operationState: undefined});
    show(operation);
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Refresh status'})).toBeInTheDocument();
    expect(mocks.retryOperation).not.toHaveBeenCalled();
  });
  it('uses valid nested recovery metadata when top-level fields are invalid', () => {
    const operation = operationState({code: 'WORKFLOW_OPERATION_PENDING', operationId: 'bad',
      requestedBy: '', requestedTs: 'bad', details: {operationId, requestedBy: 'other-user',
        requestedTs: '2026-09-26T00:00:00Z'}});
    expect(operation).toMatchObject({operationId, requestedBy: 'other-user', requestedTs: '2026-09-26T00:00:00Z'});
    show(operation);
    expect(screen.getByText(/Pending, requested by other-user at 2026-09-26T00:00:00Z/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
  });
  it('makes Refresh and new work separate after expiry', () => {
    const callbacks = show(operationState({code: 'WORKFLOW_OPERATION_EXPIRED', operationId}));
    expect(screen.getByText('Expired; remote outcome unconfirmed')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Refresh status'}));
    expect(callbacks.onRefresh).toHaveBeenCalledOnce();
    expect(callbacks.onNew).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Publish as new operation'}));
    expect(callbacks.onNew).toHaveBeenCalledOnce();
  });
  it('retains identity and controls after a transport or authentication Retry error', async () => {
    mocks.retryOperation.mockRejectedValueOnce(new Error('Network unavailable'))
      .mockRejectedValueOnce({code: 'UNAUTHORIZED', message: 'Sign in again'});
    const callbacks = show(operationState({code: 'WORKFLOW_OPERATION_UNCONFIRMED', operationId}));
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByText('Network unavailable')).toBeInTheDocument();
    expect(screen.getByText(`Unconfirmed — Retry · ${operationId}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByText(/UNAUTHORIZED: Sign in again/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Refresh status'}));
    expect(callbacks.onRefresh).toHaveBeenCalledOnce();
  });
  it('shows a definitive terminal Retry result with separate status and new-work controls', async () => {
    mocks.retryOperation.mockRejectedValue({code: 'WORKFLOW_OPERATION_NOT_FOUND', message: 'Gone'});
    const callbacks = show(operationState({code: 'WORKFLOW_OPERATION_UNCONFIRMED', operationId}));
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByText(/cannot be retried \(WORKFLOW_OPERATION_NOT_FOUND\)/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Refresh status'}));
    fireEvent.click(screen.getByRole('button', {name: 'Publish as new operation'}));
    expect(callbacks.onRefresh).toHaveBeenCalledOnce();
    expect(callbacks.onNew).toHaveBeenCalledOnce();
  });
  it('shows an initial forbidden response without claiming an operation outcome', () => {
    const callbacks = show(operationState({code: 'WORKFLOW_OPERATION_RETRY_FORBIDDEN', operationId}));
    expect(screen.getByText(/Only the original requester may Retry/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Publish as new operation'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Refresh status'}));
    expect(callbacks.onRefresh).toHaveBeenCalledOnce();
  });
  it('suppresses Retry and new work after a forbidden Retry with no requester metadata', async () => {
    mocks.retryOperation.mockRejectedValueOnce({code: 'WORKFLOW_OPERATION_RETRY_FORBIDDEN', message: 'Forbidden'});
    const callbacks = show(operationState({code: 'WORKFLOW_OPERATION_UNCONFIRMED', operationId}));
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByText(/Only the original requester may Retry/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Publish as new operation'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Refresh status'}));
    expect(callbacks.onRefresh).toHaveBeenCalledOnce();
    expect(callbacks.onNew).not.toHaveBeenCalled();
  });
  for (const code of ['WORKFLOW_INPUT_INVALID', 'VERSION_CONFLICT']) {
    it(`shows a stored ${code} failure as terminal while retaining its business code`, async () => {
      const response = {code, message: 'The original request was rejected',
        metadata: {operationState: 'failed', details: {operationId}}};
      mocks.retryOperation.mockRejectedValueOnce(portalError(response));
      const callbacks = show(operationState({code: 'WORKFLOW_OPERATION_UNCONFIRMED', operationId}));
      fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
      expect(await screen.findByText(new RegExp(`cannot be retried \\(${code}\\)`))).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', {name: 'Refresh status'}));
      fireEvent.click(screen.getByRole('button', {name: 'Publish as new operation'}));
      expect(callbacks.onRefresh).toHaveBeenCalledOnce();
      expect(callbacks.onNew).toHaveBeenCalledOnce();
      expect(mocks.retryOperation).toHaveBeenCalledTimes(1);
    });
  }
  it('keeps an unmarked business error recoverable', async () => {
    mocks.retryOperation.mockRejectedValueOnce(portalError({code: 'WORKFLOW_INPUT_INVALID',
      message: 'Unproven validation', metadata: {details: {operationId}}}));
    show(operationState({code: 'WORKFLOW_OPERATION_UNCONFIRMED', operationId}));
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByText(/WORKFLOW_INPUT_INVALID: Unproven validation/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Publish as new operation'})).not.toBeInTheDocument();
  });
  it('keeps an unmarked ledger database error recoverable with the same operation ID', async () => {
    mocks.retryOperation.mockRejectedValueOnce(portalError({code: 'WORKFLOW_OPERATION_DATABASE_ERROR',
      message: 'Ledger unavailable'}))
      .mockResolvedValueOnce({result: 'published', status: 'active'});
    const callbacks = show(operationState({code: 'WORKFLOW_OPERATION_UNCONFIRMED', operationId}));
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByText(/WORKFLOW_OPERATION_DATABASE_ERROR: Ledger unavailable/)).toBeInTheDocument();
    expect(screen.getByText(`Unconfirmed — Retry · ${operationId}`)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Refresh status'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Publish as new operation'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    await waitFor(() => expect(callbacks.onRecovered).toHaveBeenCalledWith({result: 'published', status: 'active'}));
    expect(mocks.retryOperation).toHaveBeenNthCalledWith(1, 'host-a', operationId);
    expect(mocks.retryOperation).toHaveBeenNthCalledWith(2, 'host-a', operationId);
  });
  it('keeps an unknown operation-prefixed error recoverable', async () => {
    mocks.retryOperation.mockRejectedValueOnce({code: 'WORKFLOW_OPERATION_UNEXPECTED', message: 'Unknown state'});
    show(operationState({code: 'WORKFLOW_OPERATION_UNCONFIRMED', operationId}));
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByText(/WORKFLOW_OPERATION_UNEXPECTED: Unknown state/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Publish as new operation'})).not.toBeInTheDocument();
  });
});
