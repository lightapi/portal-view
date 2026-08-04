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
    mocks.listLlm.mockResolvedValue([{
      hostId:'host-a', providerDeploymentId:'deployment-a', modelRegistrationId:'registration-a',
      providerAccountId:'account-a', deploymentName:'openai-gpt4o-ca-prod', providerType:'openai',
      physicalModelId:'gpt-4o', baseUrl:'https://api.openai.com/v1', region:'ca-central-1',
      transportBounds:{requestTimeoutMs:60000}, quotaGroupId:'openai-production-capacity',
      conformanceState:'UNKNOWN', lifecycleStatus:'DRAFT', aggregateVersion:5, active:true,
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

  it('shows the queued conformance state instead of silently reloading stale data', async () => {
    mocks.commandLlm.mockResolvedValue(undefined);
    const deployment = llmAdminResources.find(resource => resource.key === 'deployments')!;
    render(<ResourcePanel hostId="host-a" resource={deployment}/>);

    await userEvent.click(await screen.findByRole('button',{name:'Conformance'}));

    await waitFor(() => expect(mocks.commandLlm).toHaveBeenCalledWith('runLlmProviderConformance', {
      hostId:'host-a', providerDeploymentId:'deployment-a', aggregateVersion:5,
    }));
    expect(await screen.findByRole('button',{name:'Conformance pending'})).toBeDisabled();
    expect(screen.getByText(/A trusted runner must test the deployment/)).toBeInTheDocument();
  });
});
