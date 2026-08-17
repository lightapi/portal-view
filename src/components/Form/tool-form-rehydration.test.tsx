import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import Form from './Form';

const mocks = vi.hoisted(() => ({fetchClient: vi.fn()}));

vi.mock('../../contexts/UserContext', () => ({
  useUserState: () => ({host: 'host-a', isAuthenticated: true}),
}));
vi.mock('../../utils/fetchClient', () => ({BASE_URL: '', default: mocks.fetchClient}));
vi.mock('../HelpLink', () => ({default: () => null}));

describe('Update Tool form rehydration', () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    }));
  });

  it('loads persisted workflow safety metadata into the switches', async () => {
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/app/form/updateTool',
        state: {data: {
          hostId: 'host-a',
          toolId: 'tool-a',
          name: 'customer_360',
          aggregateVersion: 5,
          executionPlacement: 'workflow',
          workflowVersionRef: 'workflow-a|1.0.0',
          toolMetadata: JSON.stringify({
            safety: {
              read_only: true,
              idempotent: true,
              destructive: false,
              humanApprovalRequired: false,
            },
          }),
        }},
      }]}>
        <Routes>
          <Route path="/app/form/:formId" element={<Form/>}/>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('checkbox', {name: 'Read Only'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Idempotent'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Destructive'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Human Approval Required'})).not.toBeChecked();
  });
});
