import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import WorkflowBinding from './WorkflowBinding';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), post: vi.fn() }));
vi.mock('../../contexts/UserContext.jsx', () => ({ useUserState: () => ({ host: 'host-1' }) }));
vi.mock('../../utils/fetchClient', () => ({ default: mocks.fetch }));
vi.mock('../../api/apiPost.js', () => ({ apiPost: mocks.post }));

const binding = {
  bindingId: 'binding-1', workflowInstanceId: 'workflow-1', workflowClientId: 'client-1',
  ownerUserId: 'owner-1', state: 'ACTIVE', created_ts: '2026-09-24',
};

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.post.mockReset();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

it('keeps an accepted deletion pending until the projection no longer lists the binding', async () => {
  mocks.fetch.mockResolvedValueOnce({ bindings: [binding], total: 1 })
    .mockResolvedValueOnce({ bindings: [], total: 0 });
  mocks.post.mockResolvedValue({});
  render(<WorkflowBinding />);
  await screen.findByText('binding-1');

  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await screen.findByRole('button', { name: 'Pending' });
  expect(screen.getByText('binding-1')).toBeInTheDocument();
  expect(mocks.post).toHaveBeenCalledWith(expect.objectContaining({
    body: expect.objectContaining({ action: 'deleteWorkflowBinding',
      data: { hostId: 'host-1', bindingId: 'binding-1' } }),
  }));

  await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(screen.queryByText('binding-1')).not.toBeInTheDocument());
  expect(screen.getByText('Binding deletion completed.')).toBeInTheDocument();
});
