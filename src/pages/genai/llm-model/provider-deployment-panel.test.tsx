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
  listLlm:mocks.listLlm,queryLlm:mocks.queryLlm,commandLlm:mocks.commandLlm,
}));

describe('Deployments resource form navigation', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.listLlm.mockReset();
    mocks.commandLlm.mockReset();
    mocks.listLlm.mockResolvedValue([{
      hostId:'host-a', providerDeploymentId:'deployment-a', modelRegistrationId:'registration-a',
      providerAccountId:'account-a', deploymentName:'openai-gpt4o-ca-prod', providerType:'openai',
      physicalModelId:'gpt-4o', baseUrl:'https://api.openai.com/v1', region:'ca-central-1',
      transportBounds:{requestTimeoutMs:60000}, quotaGroupId:'openai-production-capacity',
      conformanceState:'PENDING', lifecycleStatus:'DRAFT', aggregateVersion:5, active:true,
      updateUser:'system', updateTs:'2026-08-01T00:00:00Z',
    }]);
  });

  it('opens create and update forms with only declared deployment fields', async () => {
    const deployment = llmAdminResources.find(resource => resource.key === 'deployments')!;
    render(<ResourcePanel hostId="host-a" resource={deployment}/>);

    await userEvent.click(await screen.findByRole('button',{name:'Create provider deployment'}));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/form/createProviderDeployment', {
      state:{data:{hostId:'host-a'}},
    });

    mocks.navigate.mockClear();
    await userEvent.click(await screen.findByLabelText('Edit'));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/app/form/updateProviderDevelopment', {
      state:{data:expect.objectContaining({
        hostId:'host-a', providerDeploymentId:'deployment-a', modelRegistrationId:'registration-a',
        providerAccountId:'account-a', deploymentName:'openai-gpt4o-ca-prod', providerType:'openai',
        physicalModelId:'gpt-4o', baseUrl:'https://api.openai.com/v1', region:'ca-central-1',
        transportBounds:{requestTimeoutMs:60000}, lifecycleStatus:'DRAFT', aggregateVersion:5,
      })},
    }));
    const navigationData = mocks.navigate.mock.calls[0][1].state.data;
    expect(navigationData).not.toHaveProperty('active');
    expect(navigationData).not.toHaveProperty('updateUser');
    expect(navigationData).not.toHaveProperty('updateTs');
    expect(navigationData).not.toHaveProperty('quotaGroupId');
    expect(navigationData).not.toHaveProperty('conformanceState');
  });

  it('does not expose inactive validation or conformance workflow controls', async () => {
    const deployment = llmAdminResources.find(resource => resource.key === 'deployments')!;
    render(<ResourcePanel hostId="host-a" resource={deployment}/>);

    await screen.findByText('openai-gpt4o-ca-prod');
    expect(screen.queryByLabelText('Validate')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:/Conformance/i})).not.toBeInTheDocument();
    expect(screen.queryByText('conformanceState')).not.toBeInTheDocument();
    expect(screen.queryByText('PENDING')).not.toBeInTheDocument();
    expect(mocks.commandLlm).not.toHaveBeenCalled();
  });
});
