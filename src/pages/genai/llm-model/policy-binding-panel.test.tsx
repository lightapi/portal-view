import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResourcePanel from './ResourcePanel';
import { llmAdminResources } from './types';

const mocks = vi.hoisted(() => ({
  listLlm:vi.fn(),queryLlm:vi.fn(),commandLlm:vi.fn(),navigate:vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {...actual,useNavigate:() => mocks.navigate};
});
vi.mock('./api', () => ({
  listLlm:mocks.listLlm,queryLlm:mocks.queryLlm,commandLlm:mocks.commandLlm,
}));

describe('Bindings resource form navigation', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.listLlm.mockReset();
    mocks.listLlm.mockResolvedValue([{
      hostId:'host-a',modelPolicyBindingId:'binding-a',modelPolicyId:'policy-a',
      subjectType:'AGENT',subjectId:'10000000-0000-4000-8000-000000000099',
      publicAliasId:'alias-a',agentDefault:true,aggregateVersion:3,active:true,
      updateUser:'system',updateTs:'2026-08-01T12:00:00Z',
    }]);
  });

  it('opens create and update forms with only declared binding fields', async () => {
    const bindings = llmAdminResources.find(resource => resource.key === 'bindings')!;
    render(<ResourcePanel hostId="host-a" resource={bindings}/>);

    await userEvent.click(await screen.findByRole('button',{name:'Create policy binding'}));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/form/createPolicyBinding',{
      state:{data:{hostId:'host-a'}},
    });

    mocks.navigate.mockClear();
    await userEvent.click(await screen.findByLabelText('Edit'));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/app/form/updatePolicyBinding',{
      state:{data:expect.objectContaining({
        hostId:'host-a',modelPolicyBindingId:'binding-a',modelPolicyId:'policy-a',
        subjectType:'AGENT',subjectId:'10000000-0000-4000-8000-000000000099',
        publicAliasId:'alias-a',agentDefault:true,aggregateVersion:3,
      })},
    }));
    const navigationData = mocks.navigate.mock.calls[0][1].state.data;
    expect(navigationData).not.toHaveProperty('active');
    expect(navigationData).not.toHaveProperty('updateUser');
    expect(navigationData).not.toHaveProperty('updateTs');
  });
});
