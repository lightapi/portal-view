import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {useState} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({fetchClient: vi.fn(), identity: {userId: 'requester-a', positions: ''}}));
vi.mock('../../contexts/UserContext', () => ({useUserState: () => mocks.identity}));
vi.mock('../../utils/fetchClient', () => ({default: mocks.fetchClient}));
import {WorkflowToolFields} from './ToolForm';

type TestModel = {hostId: string; executionPlacement: string; workflowVersionRef: string;
  readOnly: boolean; workflowBinding: Record<string, any>};
function show(initial: TestModel) {
  let latest = initial;
  function Harness() {
    const [model, setModel] = useState(initial);
    latest = model;
    return <WorkflowToolFields model={model} change={(path, value) => setModel(previous => {
      const next = structuredClone(previous);
      const parts = path.split('.');
      let target: any = next;
      for (const part of parts.slice(0, -1)) target = target[part] ??= {};
      target[parts.at(-1)!] = value;
      return next;
    })} />;
  }
  render(<Harness />);
  return () => latest;
}

const initial = {hostId: 'host-a', executionPlacement: 'workflow', workflowVersionRef: 'definition-a|2.0',
  readOnly: false, workflowBinding: {}};

beforeEach(() => {
  mocks.identity.userId = 'requester-a'; mocks.identity.positions = '';
  mocks.fetchClient.mockReset().mockResolvedValue({ownerUserId: 'owner-a', ownerPositionId: 'position-a'});
});

describe('workflow-backed Tool fields', () => {
  it('shows the selected owner and approval notice with verified identity', async () => {
    show(initial);
    expect(await screen.findByText(/Definition owner: owner-a · position position-a/)).toBeInTheDocument();
    expect(screen.getByText(/Publication requires approval/)).toBeInTheDocument();
    expect(mocks.fetchClient.mock.calls[0][0]).toContain('getWfDefinitionById');
    expect(screen.queryByLabelText(/async/i)).not.toBeInTheDocument();
  });
  it('recognizes position ownership and hides the approval notice', async () => {
    mocks.identity.positions = 'position-a';
    show(initial);
    await screen.findByText(/Definition owner:/);
    expect(screen.queryByText(/Publication requires approval/)).not.toBeInTheDocument();
  });
  it('fills a write Tool replay window and exposes all four limits and lowercase cancellation options', async () => {
    const model = show(initial);
    await waitFor(() => expect(model().workflowBinding.idempotencyPolicy.resultReplayMs).toBe(600000));
    expect(screen.getByText('Write Tools require at least 600000 ms.')).toBeInTheDocument();
    for (const field of ['maximumConcurrentRuns', 'maximumConcurrentRunsPerUser', 'startsPerMinute', 'startsPerMinutePerUser']) {
      expect(screen.getByLabelText(field)).toBeInTheDocument();
    }
    fireEvent.mouseDown(screen.getByLabelText('Cancellation policy'));
    expect(screen.getByRole('option', {name: 'Cooperative'})).toBeInTheDocument();
  });
  it('populates saved nested values and edits one without losing the others', async () => {
    const model = show({...initial, workflowBinding: {
      cancellationPolicy: 'disabled', admissionLimits: {maximumConcurrentRuns: 9,
        maximumConcurrentRunsPerUser: 2, startsPerMinute: 77, startsPerMinutePerUser: 7},
      callerPolicy: {anyRole: ['operator']}, idempotencyPolicy: {kind: 'explicit', resultReplayMs: 900000},
      runtimeBounds: {maximumNestedCalls: 4},
    }});
    await screen.findByText(/Definition owner:/);
    expect(screen.getByLabelText('maximumConcurrentRuns')).toHaveValue(9);
    expect(screen.getByLabelText('Result replay window (ms)')).toHaveValue(900000);
    fireEvent.change(screen.getByLabelText('maximumConcurrentRuns'), {target: {value: '10'}});
    fireEvent.change(screen.getByLabelText('Maximum parallel branches'), {target: {value: '3'}});
    expect(model().workflowBinding.admissionLimits.maximumConcurrentRuns).toBe(10);
    expect(model().workflowBinding.idempotencyPolicy).toEqual({kind: 'explicit', resultReplayMs: 900000});
    expect(model().workflowBinding.runtimeBounds).toEqual({maximumNestedCalls: 4, maximumParallelism: 3});
  });
});
