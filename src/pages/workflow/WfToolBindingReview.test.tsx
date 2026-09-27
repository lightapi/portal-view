import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({getBinding: vi.fn(), decideBinding: vi.fn(), revokeBinding: vi.fn(),
  retryOperation: vi.fn(), refreshBindings: vi.fn()}));
vi.mock('../../contexts/UserContext', () => ({useUserState: () => ({host: 'host-a', userId: 'owner-a'})}));
vi.mock('./workflowAdminClient', () => ({workflowAdminClient: {getBinding: mocks.getBinding}}));
vi.mock('./workflowPortalClient', async importOriginal => {
  const original = await importOriginal<typeof import('./workflowPortalClient')>();
  return {...original, workflowPortalClient: {decideBinding: mocks.decideBinding,
    revokeBinding: mocks.revokeBinding, retryOperation: mocks.retryOperation,
    refreshBindings: mocks.refreshBindings}};
});
import WfToolBindingReview, {bindingDiff} from './WfToolBindingReview';

const revision = {bindingId: 'revision-new', toolId: 'tool-a', toolName: 'Create order', wfDefId: 'definition-a',
  workflowVersion: '2.0', revisionStatus: 'pendingApproval', bindingDigest: 'sha256:new',
  requestedBy: 'requester-a', requestedTs: '2026-09-26T00:00:00Z', owner: {userId: 'owner-a'},
  binding: {definitionDigest: 'sha256:def2', invocationMode: 'sync', cancellationPolicy: 'cooperative',
    admissionLimits: {maximumConcurrentRuns: 3}, idempotencyPolicy: {resultReplayMs: 600000}},
  dependencies: [{nestedToolId: 'nested-new'}], endpointTargets: [{endpointRef: 'orders'}],
  writeTasks: [{taskName: 'place-order', kind: 'http'}]};
const view = {revision, activeRevision: {...revision, bindingId: 'revision-old', workflowVersion: '1.0',
  revisionStatus: 'approved',
  binding: {...revision.binding, cancellationPolicy: 'before-effects-only'},
  dependencies: [{nestedToolId: 'nested-old'}]},
  carryOverDeniedReason: 'reach grew', decisions: [{decisionId: 'decision-a', bindingId: 'revision-old',
    action: 'approve', actor: 'owner-a', comment: 'Reviewed', decidedTs: '2026-09-25T00:00:00Z'}]};

function show() {
  return render(<MemoryRouter initialEntries={['/app/workflow/tool-bindings/review/revision-new']}>
    <Routes><Route path="/app/workflow/tool-bindings/review/:bindingId" element={<WfToolBindingReview />} /></Routes>
  </MemoryRouter>);
}

beforeEach(() => {
  mocks.getBinding.mockReset().mockResolvedValue(view);
  mocks.decideBinding.mockReset().mockResolvedValue({revisionStatus: 'approved'});
  mocks.revokeBinding.mockReset().mockResolvedValue({revisionStatus: 'revoked'});
  mocks.retryOperation.mockReset();
});

describe('immutable Workflow binding review', () => {
  it('shows all review sections, active diff, write reach, history and carry-over denial', async () => {
    show();
    expect(await screen.findByText('Requester')).toBeInTheDocument();
    for (const title of ['Target', 'Execution', 'Limits', 'Reach', 'Decision history', 'Changes from active revision']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    expect(screen.getByText(/place-order/)).toBeInTheDocument();
    expect(screen.getByText(/Carry-over denied: reach grew/)).toBeInTheDocument();
    expect(screen.getByText(/Reviewed/)).toBeInTheDocument();
    expect(screen.getByText('cancellationPolicy')).toBeInTheDocument();
  });
  it('shows and diffs an output-schema-only change including empty to not-empty JSON', async () => {
    const changed = {...revision, binding: {...revision.binding, inputSchema: {}, outputSchema: {not: {}}}};
    const active = {...revision, binding: {...revision.binding, inputSchema: {}, outputSchema: {}}};
    mocks.getBinding.mockResolvedValue({...view, revision: changed, activeRevision: active});
    expect(bindingDiff(changed, active)).toEqual([{field: 'outputSchema', before: {}, after: {not: {}}}]);
    show();
    expect(await screen.findByText('Input schema')).toBeInTheDocument();
    expect(screen.getByText('Output schema')).toBeInTheDocument();
    expect(screen.getByText('outputSchema')).toBeInTheDocument();
    expect(screen.getAllByText(/"not"/).length).toBeGreaterThan(0);
  });
  it('pins Approve to the selected revision and digest; Reject needs a comment', async () => {
    show();
    await screen.findByText('Requester');
    expect(screen.getByRole('button', {name: 'Reject'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: 'Approve'}));
    await waitFor(() => expect(mocks.decideBinding).toHaveBeenCalledWith('host-a', 'revision-new',
      'sha256:new', 'approve', undefined));
    fireEvent.change(screen.getByLabelText('Decision comment'), {target: {value: 'Not safe'}});
    expect(screen.getByRole('button', {name: 'Reject'})).toBeEnabled();
  });
  it('shows a stale error without loading a new digest or retrying automatically', async () => {
    mocks.decideBinding.mockRejectedValue({code: 'WORKFLOW_DEFINITION_MISMATCH', message: 'binding changed since review'});
    show();
    await screen.findByText('Requester');
    fireEvent.click(screen.getByRole('button', {name: 'Approve'}));
    expect(await screen.findByText(/WORKFLOW_DEFINITION_MISMATCH: binding changed since review/)).toBeInTheDocument();
    expect(mocks.getBinding).toHaveBeenCalledTimes(1);
    expect(mocks.retryOperation).not.toHaveBeenCalled();
  });
  it('requires a nonblank comment to revoke an approved revision', async () => {
    mocks.getBinding.mockResolvedValue({...view, revision: {...revision, revisionStatus: 'approved'}, activeRevision: undefined});
    show();
    await screen.findByText('Requester');
    expect(screen.getByRole('button', {name: 'Revoke'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Decision comment'), {target: {value: '  '}});
    expect(screen.getByRole('button', {name: 'Revoke'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Decision comment'), {target: {value: 'Retiring access'}});
    fireEvent.click(screen.getByRole('button', {name: 'Revoke'}));
    await waitFor(() => expect(mocks.revokeBinding).toHaveBeenCalledWith('host-a', 'revision-new',
      'sha256:new', 'Retiring access'));
  });
});
