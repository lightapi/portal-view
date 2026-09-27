import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
const mocks = vi.hoisted(() => ({start: vi.fn()}));
vi.mock('../../contexts/UserContext', () => ({useUserState: () => ({host: 'host-a'})}));
vi.mock('./workflowPortalClient', () => ({workflowPortalClient: {start: mocks.start}}));
import WorkflowStart from './WorkflowStart';

beforeEach(() => {mocks.start.mockReset().mockRejectedValue(new Error('WORKFLOW_DEFINITION_MISMATCH: saved head changed'));
  vi.stubGlobal('crypto', {randomUUID: () => 'attempt-a'});});

describe('standalone Workflow Start', () => {
  it('uses Portal, displays synchronization errors, and reuses the attempt key', async () => {
    render(<MemoryRouter initialEntries={[{pathname: '/app/form/startWorkflow',
      state: {data: {wfDefId: 'definition-a'}}}]}><Routes>
      <Route path="/app/form/startWorkflow" element={<WorkflowStart />} />
    </Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', {name: 'Start Workflow'}));
    expect(await screen.findByText(/WORKFLOW_DEFINITION_MISMATCH/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Start Workflow'}));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(2));
    expect(mocks.start).toHaveBeenNthCalledWith(1, 'host-a', 'definition-a', {}, 'attempt-a');
    expect(mocks.start).toHaveBeenNthCalledWith(2, 'host-a', 'definition-a', {}, 'attempt-a');
  });
});
