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
      details: {operationId: 'operation-a'}}));
    expect(screen.getByText(/Unconfirmed — Retry · operation-a/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    await waitFor(() => expect(mocks.retryOperation).toHaveBeenCalledWith('host-a', 'operation-a'));
    expect(callbacks.onRecovered).toHaveBeenCalledWith({revisionStatus: 'approved'});
    expect(callbacks.onNew).not.toHaveBeenCalled();
  });
  it('shows the other requester and has no Retry', () => {
    show(operationState({statusCode: 502, code: 'WORKFLOW_OPERATION_PENDING',
      metadata: {details: {operationId: 'operation-a', requestedBy: 'other-user',
        requestedTs: '2026-09-26T00:00:00Z'}}}));
    expect(screen.getByText(/Pending, requested by other-user at 2026-09-26T00:00:00Z/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
  });
  it('makes Refresh and new work separate after expiry', () => {
    const callbacks = show(operationState({code: 'WORKFLOW_OPERATION_EXPIRED', operationId: 'operation-a'}));
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
    const callbacks = show(operationState({code: 'WORKFLOW_OPERATION_UNCONFIRMED', operationId: 'operation-a'}));
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByText('Network unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Unconfirmed — Retry · operation-a/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByText(/UNAUTHORIZED: Sign in again/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Refresh status'}));
    expect(callbacks.onRefresh).toHaveBeenCalledOnce();
  });
  it('shows a definitive terminal Retry result with separate status and new-work controls', async () => {
    mocks.retryOperation.mockRejectedValue({code: 'WORKFLOW_OPERATION_NOT_FOUND', message: 'Gone'});
    const callbacks = show(operationState({code: 'WORKFLOW_OPERATION_UNCONFIRMED', operationId: 'operation-a'}));
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByText(/cannot be retried \(WORKFLOW_OPERATION_NOT_FOUND\)/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Refresh status'}));
    fireEvent.click(screen.getByRole('button', {name: 'Publish as new operation'}));
    expect(callbacks.onRefresh).toHaveBeenCalledOnce();
    expect(callbacks.onNew).toHaveBeenCalledOnce();
  });
});
