import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Form from './Form';

const mocks = vi.hoisted(() => ({fetchClient:vi.fn()}));

vi.mock('../../contexts/UserContext', () => ({
  useUserState: () => ({host:'host-a',isAuthenticated:true}),
}));
vi.mock('../../utils/fetchClient', () => ({BASE_URL:'',default:mocks.fetchClient}));
vi.mock('../HelpLink', () => ({default:() => null}));

function RouteResult() {
  return <output data-testid="route-result">{useLocation().pathname}</output>;
}

function renderRouteForm(formId:'createAliasRoute'|'updateAliasRoute',data:Record<string,unknown>) {
  return render(<MemoryRouter initialEntries={[{pathname:`/app/form/${formId}`,state:{data}}]}><Routes>
    <Route path="/app/form/:formId" element={<Form/>}/>
    <Route path="/app/genai/LlmModelControlPlane" element={<RouteResult/>}/>
    <Route path="/app/failure" element={<RouteResult/>}/>
  </Routes></MemoryRouter>);
}

async function applyResidency(value:unknown) {
  const group = screen.getByRole('group',{name:'Residency Conditions'});
  await userEvent.click(within(group).getByRole('tab',{name:'JSON'}));
  fireEvent.change(within(group).getByRole('textbox',{name:'Residency Conditions JSON editor'}),{
    target:{value:JSON.stringify(value)},
  });
  await userEvent.click(within(group).getByRole('button',{name:'Apply'}));
}

describe('LLM alias route form routes', () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue({aliasRouteId:'route-a'});
    vi.stubGlobal('fetch',vi.fn().mockImplementation(async (request:RequestInfo|URL) => {
      const url = String(request);
      const values = url.includes('getLlmPublicAliasLabel')
        ? [{id:'alias-a',label:'governed-chat'}]
        : url.includes('getLlmProviderDeploymentLabel')
          ? [{id:'deployment-a',label:'openai-prod-ca'}] : [];
      return {json:async () => values,ok:true,status:200};
    }));
  });

  it('submits the create command with fixed MVP routing fields', async () => {
    const user = userEvent.setup();
    renderRouteForm('createAliasRoute',{
      hostId:'host-a',publicAliasId:'alias-a',providerDeploymentId:'deployment-a',routePriority:0,
    });
    expect(await screen.findByRole('heading',{name:'Create Alias Route'})).toBeInTheDocument();
    await applyResidency({regions:['ca-central-1']});

    await user.click(screen.getByRole('button',{name:'Create Alias Route'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai',action:'createLlmAliasRoute',data:{
        hostId:'host-a',publicAliasId:'alias-a',providerDeploymentId:'deployment-a',
        routePriority:0,routeWeight:1,fallbackEnabled:false,canaryPercent:0,
        residencyConditions:{regions:['ca-central-1']},
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });

  it('retains identity and submits routing changes on update', async () => {
    const user = userEvent.setup();
    renderRouteForm('updateAliasRoute',{
      hostId:'host-a',aliasRouteId:'route-a',publicAliasId:'alias-a',
      providerDeploymentId:'deployment-a',routePriority:10,routeWeight:1,
      fallbackEnabled:true,canaryPercent:0,residencyConditions:{regions:['ca-central-1']},
      aggregateVersion:6,
    });
    expect(await screen.findByRole('heading',{name:'Update Alias Route'})).toBeInTheDocument();
    expect(screen.getByDisplayValue('route-a')).toBeDisabled();
    expect(screen.getByDisplayValue('6')).toBeDisabled();

    await user.click(screen.getByRole('button',{name:'Update Alias Route'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai',action:'updateLlmAliasRoute',data:{
        hostId:'host-a',aliasRouteId:'route-a',publicAliasId:'alias-a',
        providerDeploymentId:'deployment-a',routePriority:10,routeWeight:1,
        fallbackEnabled:true,canaryPercent:0,residencyConditions:{regions:['ca-central-1']},
        aggregateVersion:6,
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });
});
