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

function renderDeploymentForm(
  formId:'createProviderDeployment'|'updateProviderDevelopment',
  data:Record<string,unknown>,
) {
  return render(<MemoryRouter initialEntries={[{pathname:`/app/form/${formId}`,state:{data}}]}><Routes>
    <Route path="/app/form/:formId" element={<Form/>}/>
    <Route path="/app/genai/LlmModelControlPlane" element={<RouteResult/>}/>
    <Route path="/app/failure" element={<RouteResult/>}/>
  </Routes></MemoryRouter>);
}

async function applyJson(groupName:string,value:unknown) {
  const group = screen.getByRole('group',{name:groupName});
  await userEvent.click(within(group).getByRole('tab',{name:'JSON'}));
  fireEvent.change(within(group).getByRole('textbox',{name:`${groupName} JSON editor`}), {
    target:{value:JSON.stringify(value)},
  });
  await userEvent.click(within(group).getByRole('button',{name:'Apply'}));
}

describe('LLM provider deployment form routes', () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue({providerDeploymentId:'deployment-a'});
    vi.stubGlobal('fetch',vi.fn().mockImplementation(async (request:RequestInfo|URL) => {
      const url = String(request);
      const values = url.includes('getLlmModelRegistrationLabel')
        ? [{id:'registration-a',label:'Production / GPT-4o'}]
        : url.includes('getLlmProviderAccountLabel')
          ? [{id:'account-a',label:'OpenAI Production'}]
          : url.includes('getLlmProviderEndpointLabel')
            ? [{id:'endpoint-a',label:'Groq Production'}]
            : url.includes('name=model_provider') ? ['openai']
              : url.includes('name=model_name') ? ['gpt-4o']
                : url.includes('name=region') ? ['ca-central-1'] : [];
      return {json:async () => values,ok:true,status:200};
    }));
  });

  it('submits the create command with typed transport bounds', async () => {
    const user = userEvent.setup();
    renderDeploymentForm('createProviderDeployment',{
      hostId:'host-a', modelRegistrationId:'registration-a', providerAccountId:'account-a',
      deploymentName:'groq-llama-dev', providerType:'groq', providerProtocol:'openai_chat', physicalModelId:'llama-3.3-70b-versatile',
      baseUrl:'https://api.groq.com/openai/v1', providerEndpointId:'endpoint-a',
      deploymentRevisionId:'groq-llama-dev/r1', physicalRuntimeId:'groq/llama-3.3-70b-versatile',
      capacityDomainId:'groq-production',
      runtimeCapacity:{maxParallelRequests:32,maxQueuedRequests:32,requestTimeoutMs:60000},
      readinessPolicy:'IMMEDIATE', region:'ca-central-1',
    });
    expect(await screen.findByRole('heading',{name:'Create Provider Deployment'})).toBeInTheDocument();

    await applyJson('Transport Bounds',{connectTimeoutMs:5000,requestTimeoutMs:60000});
    await user.click(screen.getByRole('button',{name:'Create Provider Deployment'}));

    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai', action:'createLlmProviderDeployment', data:{
        hostId:'host-a', modelRegistrationId:'registration-a', providerAccountId:'account-a',
        deploymentName:'groq-llama-dev', providerType:'groq', providerProtocol:'openai_chat', physicalModelId:'llama-3.3-70b-versatile',
        baseUrl:'https://api.groq.com/openai/v1', providerEndpointId:'endpoint-a',
        deploymentRevisionId:'groq-llama-dev/r1', physicalRuntimeId:'groq/llama-3.3-70b-versatile',
        capacityDomainId:'groq-production',
        runtimeCapacity:{maxParallelRequests:32,maxQueuedRequests:32,requestTimeoutMs:60000},
        readinessPolicy:'IMMEDIATE', region:'ca-central-1',
        transportBounds:{connectTimeoutMs:5000,requestTimeoutMs:60000},
        lifecycleStatus:'DRAFT',
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('conformanceResult');
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('quotaGroupId');
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('conformanceState');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });

  it('retains update identity and optimistic-concurrency fields', async () => {
    const user = userEvent.setup();
    renderDeploymentForm('updateProviderDevelopment',{
      hostId:'host-a', providerDeploymentId:'deployment-a', modelRegistrationId:'registration-a',
      providerAccountId:'account-a', deploymentName:'openai-gpt4o-ca-prod', providerType:'openai',
      providerProtocol:'openai_chat', physicalModelId:'gpt-4o', baseUrl:'https://api.openai.com/v1', region:null,
      transportBounds:{requestTimeoutMs:60000},
      lifecycleStatus:'DRAFT', aggregateVersion:5,
    });
    expect(await screen.findByRole('heading',{name:'Update Provider Deployment'})).toBeInTheDocument();
    expect(screen.getByDisplayValue('deployment-a')).toBeDisabled();
    expect(screen.getByDisplayValue('5')).toBeDisabled();

    await user.click(screen.getByRole('button',{name:'Update Provider Deployment'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai', action:'updateLlmProviderDeployment', data:{
        hostId:'host-a', providerDeploymentId:'deployment-a', modelRegistrationId:'registration-a',
        providerAccountId:'account-a', deploymentName:'openai-gpt4o-ca-prod', providerType:'openai',
        providerProtocol:'openai_chat', physicalModelId:'gpt-4o', baseUrl:'https://api.openai.com/v1', region:null,
        transportBounds:{requestTimeoutMs:60000}, lifecycleStatus:'DRAFT', aggregateVersion:5,
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('quotaGroupId');
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('conformanceState');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });
});
