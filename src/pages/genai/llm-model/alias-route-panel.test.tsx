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

describe('Routes resource form navigation', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.listLlm.mockReset();
    mocks.listLlm.mockResolvedValue([{
      hostId:'host-a',aliasRouteId:'route-a',publicAliasId:'alias-a',
      providerDeploymentId:'deployment-a',routePriority:0,routeWeight:1,
      fallbackEnabled:false,canaryPercent:0,residencyConditions:{regions:['ca-central-1']},
      aggregateVersion:4,active:true,updateUser:'system',updateTs:'2026-08-01T12:00:00Z',
    }]);
  });

  it('opens create and update forms with only declared route fields', async () => {
    const route = llmAdminResources.find(resource => resource.key === 'routes')!;
    render(<ResourcePanel hostId="host-a" resource={route}/>);

    await userEvent.click(await screen.findByRole('button',{name:'Create alias route'}));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/form/createAliasRoute',{
      state:{data:{hostId:'host-a'}},
    });

    mocks.navigate.mockClear();
    await userEvent.click(await screen.findByLabelText('Edit'));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/app/form/updateAliasRoute',{
      state:{data:expect.objectContaining({
        hostId:'host-a',aliasRouteId:'route-a',publicAliasId:'alias-a',
        providerDeploymentId:'deployment-a',routePriority:0,routeWeight:1,
        fallbackEnabled:false,canaryPercent:0,residencyConditions:{regions:['ca-central-1']},
        aggregateVersion:4,
      })},
    }));
    const navigationData = mocks.navigate.mock.calls[0][1].state.data;
    expect(navigationData).not.toHaveProperty('active');
    expect(navigationData).not.toHaveProperty('updateUser');
    expect(navigationData).not.toHaveProperty('updateTs');
  });
});
