import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
const mocks = vi.hoisted(() => ({listBindings: vi.fn()}));
vi.mock('../../contexts/UserContext', () => ({useUserState: () => ({host: 'host-a'})}));
vi.mock('./workflowAdminClient', () => ({workflowAdminClient: {listBindings: mocks.listBindings}}));
import WfToolBindings from './WfToolBindings';

beforeEach(() => {mocks.listBindings.mockReset().mockResolvedValueOnce({items: [{bindingId: 'revision-a',
  toolName: 'Orders', workflowVersion: '1.0', revisionStatus: 'approved', requestedBy: 'user-a'}],
  nextCursor: '2026-09-26T00:00:00Z|revision-a'}).mockResolvedValueOnce({items: [{bindingId: 'revision-b',
  toolName: 'Returns', workflowVersion: '2.0', revisionStatus: 'pendingApproval', requestedBy: 'user-b'}]});});

describe('owner Tool bindings', () => {
  it('explains an empty revision list without claiming that no Portal binding exists', async () => {
    mocks.listBindings.mockReset().mockResolvedValue({items: []});
    render(<MemoryRouter initialEntries={['/app/workflow/tool-bindings/definition-a']}>
      <Routes><Route path="/app/workflow/tool-bindings/:wfDefId" element={<WfToolBindings />} /></Routes>
    </MemoryRouter>);
    expect(await screen.findByText(/No requested Tool binding revisions/)).toBeInTheDocument();
  });
  it('uses the exact server cursor and retains both pages of immutable revisions', async () => {
    render(<MemoryRouter initialEntries={['/app/workflow/tool-bindings/definition-a']}>
      <Routes><Route path="/app/workflow/tool-bindings/:wfDefId" element={<WfToolBindings />} /></Routes>
    </MemoryRouter>);
    expect(await screen.findByText(/Orders · 1.0/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Load more'}));
    expect(await screen.findByText(/Returns · 2.0/)).toBeInTheDocument();
    await waitFor(() => expect(mocks.listBindings).toHaveBeenNthCalledWith(2, {
      hostId: 'host-a', role: 'owner', wfDefId: 'definition-a', limit: 100,
      cursor: '2026-09-26T00:00:00Z|revision-a',
    }));
  });
});
