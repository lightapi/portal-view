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

describe('Credentials resource form navigation', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.listLlm.mockReset();
    mocks.listLlm.mockResolvedValue([{
      hostId:'host-a',providerCredentialId:'credential-a',providerDeploymentId:'deployment-a',
      credentialVersion:2,secretReference:'vault://llm/openai-production/api-key',
      effectiveTs:'2026-08-01T12:00:00Z',expiresTs:'2026-11-01T12:00:00Z',
      lifecycleStatus:'ACTIVE',aggregateVersion:4,active:true,
      updateUser:'system',updateTs:'2026-08-01T12:00:00Z',
    }]);
  });

  it('opens create and update forms with only declared credential fields', async () => {
    const credential = llmAdminResources.find(resource => resource.key === 'credentials')!;
    render(<ResourcePanel hostId="host-a" resource={credential}/>);

    await userEvent.click(await screen.findByRole('button',{name:'Create provider credential'}));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/form/createProviderCredential',{
      state:{data:{hostId:'host-a'}},
    });

    mocks.navigate.mockClear();
    await userEvent.click(await screen.findByLabelText('Edit'));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/app/form/updateProviderCredential',{
      state:{data:expect.objectContaining({
        hostId:'host-a',providerCredentialId:'credential-a',providerDeploymentId:'deployment-a',
        credentialVersion:2,secretReference:'vault://llm/openai-production/api-key',
        effectiveTs:'2026-08-01T12:00:00Z',expiresTs:'2026-11-01T12:00:00Z',
        lifecycleStatus:'ACTIVE',aggregateVersion:4,
      })},
    }));
    const navigationData = mocks.navigate.mock.calls[0][1].state.data;
    expect(navigationData).not.toHaveProperty('active');
    expect(navigationData).not.toHaveProperty('updateUser');
    expect(navigationData).not.toHaveProperty('updateTs');
  });
});
