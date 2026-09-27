import {render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ActionDisplayProvider} from '../../contexts/ActionDisplayContext';
const mocks = vi.hoisted(() => ({inboxSummary: vi.fn(), listHumanTasks: vi.fn(), listBindings: vi.fn()}));
vi.mock('../../contexts/UserContext', () => ({useUserState: () => ({host: 'host-a'})}));
vi.mock('./workflowAdminClient', () => ({workflowAdminClient: mocks}));
import Worklist from './Worklist';

beforeEach(() => {
  mocks.inboxSummary.mockReset().mockResolvedValue({tabs: [{id: 'all', label: 'All', count: 0}]});
  mocks.listHumanTasks.mockReset().mockResolvedValue({humanTasks: [], total: 0});
  mocks.listBindings.mockReset().mockResolvedValueOnce({items: [{bindingId: 'revision-a',
    toolName: 'Orders', workflowVersion: '1.0', requestedBy: 'requester-a'}], nextCursor: 'cursor-a'})
    .mockResolvedValueOnce({items: [{bindingId: 'revision-b', toolName: 'Returns',
      workflowVersion: '2.0', requestedBy: 'requester-b'}]});
});

describe('Worklist binding approvals', () => {
  it('loads every pending owner page and preserves the human-task tabs', async () => {
    render(<ActionDisplayProvider><MemoryRouter initialEntries={['/app/workflow/Worklist']}><Routes>
      <Route path="/app/workflow/Worklist" element={<Worklist />} />
    </Routes></MemoryRouter></ActionDisplayProvider>);
    expect(await screen.findByText('Tool binding approvals (2)')).toBeInTheDocument();
    expect(screen.getByText(/Orders · 1.0/)).toBeInTheDocument();
    expect(screen.getByText(/Returns · 2.0/)).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'All (0)'})).toBeInTheDocument();
    expect(mocks.listBindings).toHaveBeenNthCalledWith(2, {hostId: 'host-a', role: 'owner',
      status: 'pendingApproval', limit: 100, cursor: 'cursor-a'});
  });
});
