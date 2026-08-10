import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResourcePanel from './ResourcePanel';
import { llmAdminResources } from './types';

const mocks = vi.hoisted(() => ({
  listLlm:vi.fn(), queryLlm:vi.fn(), commandLlm:vi.fn(), navigate:vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {...actual,useNavigate:() => mocks.navigate};
});
vi.mock('./api', () => ({
  listLlm:mocks.listLlm, queryLlm:mocks.queryLlm, commandLlm:mocks.commandLlm,
}));

describe('Accounts resource form navigation', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.listLlm.mockReset();
    mocks.listLlm.mockResolvedValue([{
      hostId:'host-a', providerAccountId:'account-a', accountName:'OpenAI Production',
      providerType:'openai', billingPrincipal:'genai-cost-center',
      quotaGroupId:'openai-production', capacityMetadata:{serviceTier:'production'},
      aggregateVersion:3, active:true,
      updateUser:'system', updateTs:'2026-07-31T00:00:00Z',
    }]);
  });

  it('opens create and update forms with only declared account fields', async () => {
    const account = llmAdminResources.find(resource => resource.key === 'accounts')!;
    render(<ResourcePanel hostId="host-a" resource={account}/>);

    await userEvent.click(await screen.findByRole('button',{name:'Create provider account'}));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/form/createProviderAccount', {
      state:{data:{hostId:'host-a'}},
    });

    mocks.navigate.mockClear();
    await userEvent.click(await screen.findByLabelText('Edit'));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/app/form/updateProviderAccount', {
      state:{data:expect.objectContaining({
        hostId:'host-a', providerAccountId:'account-a', accountName:'OpenAI Production',
        providerType:'openai', billingPrincipal:'genai-cost-center',
        quotaGroupId:'openai-production', capacityMetadata:{serviceTier:'production'},
        aggregateVersion:3,
      })},
    }));
    const navigationData = mocks.navigate.mock.calls[0][1].state.data;
    expect(navigationData).not.toHaveProperty('active');
    expect(navigationData).not.toHaveProperty('updateUser');
    expect(navigationData).not.toHaveProperty('updateTs');
  });
});
