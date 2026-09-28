import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useNavigate} from 'react-router-dom';
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
  it('resets input and prior attempt when the mounted route changes definition', async () => {
    function Page() {
      const navigate = useNavigate();
      return <><button onClick={() => navigate('/app/form/startWorkflow',
        {state: {data: {wfDefId: 'definition-b', input: {value: 2}}}})}>Open second workflow</button>
        <WorkflowStart /></>;
    }
    render(<MemoryRouter initialEntries={[{pathname: '/app/form/startWorkflow',
      state: {data: {wfDefId: 'definition-a', input: {value: 1}}}}]}><Routes>
      <Route path="/app/form/startWorkflow" element={<Page />} />
    </Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', {name: 'Start Workflow'}));
    expect(await screen.findByText(/WORKFLOW_DEFINITION_MISMATCH/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Open second workflow'}));
    expect(screen.getByLabelText('Workflow Definition ID')).toHaveValue('definition-b');
    expect(screen.getByLabelText('Workflow Input (JSON)')).toHaveValue(JSON.stringify({value: 2}, null, 2));
    expect(screen.queryByText(/WORKFLOW_DEFINITION_MISMATCH/)).not.toBeInTheDocument();
  });
  it('ignores an earlier in-flight start failure after the route changes', async () => {
    let rejectStart!: (error: Error) => void;
    mocks.start.mockImplementationOnce(() => new Promise((_, reject) => { rejectStart = reject; }));
    function Page() {
      const navigate = useNavigate();
      return <><button onClick={() => navigate('/app/form/startWorkflow',
        {state: {data: {wfDefId: 'definition-b'}}})}>Open second workflow</button><WorkflowStart /></>;
    }
    render(<MemoryRouter initialEntries={[{pathname: '/app/form/startWorkflow',
      state: {data: {wfDefId: 'definition-a'}}}]}><Routes>
      <Route path="/app/form/startWorkflow" element={<Page />} />
    </Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', {name: 'Start Workflow'}));
    fireEvent.click(screen.getByRole('button', {name: 'Open second workflow'}));
    expect(screen.getByRole('button', {name: 'Start Workflow'})).toBeEnabled();
    await act(async () => { rejectStart(new Error('Old workflow failed')); });
    expect(screen.queryByText('Old workflow failed')).not.toBeInTheDocument();
  });
});
