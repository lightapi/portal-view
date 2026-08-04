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

function renderProviderAccountForm(
  formId:'createProviderAccount'|'updateProviderAccount',
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

describe('LLM provider account form routes', () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue({providerAccountId:'account-a'});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
      json:async () => ['openai','anthropic'], ok:true, status:200,
    }));
  });

  it('submits the create command with structured capacity metadata', async () => {
    const user = userEvent.setup();
    renderProviderAccountForm('createProviderAccount',{
      hostId:'host-a', accountName:'OpenAI Production', providerType:'openai',
      billingPrincipal:'genai-cost-center', quotaGroupId:'openai-production',
    });
    expect(await screen.findByRole('heading',{name:'Create Provider Account'})).toBeInTheDocument();

    await applyJson('Capacity Metadata',{serviceTier:'production',rpm:1000});
    await user.click(screen.getByRole('button',{name:'Create Provider Account'}));

    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai', action:'createLlmProviderAccount', data:{
        hostId:'host-a', accountName:'OpenAI Production', providerType:'openai',
        billingPrincipal:'genai-cost-center', quotaGroupId:'openai-production',
        capacityMetadata:{serviceTier:'production',rpm:1000}, lifecycleStatus:'DRAFT',
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });

  it('retains update identity and optimistic-concurrency fields', async () => {
    const user = userEvent.setup();
    renderProviderAccountForm('updateProviderAccount',{
      hostId:'host-a', providerAccountId:'account-a', accountName:'OpenAI Production',
      providerType:'openai', billingPrincipal:'genai-cost-center',
      quotaGroupId:'openai-production', capacityMetadata:{serviceTier:'production'},
      lifecycleStatus:'ACTIVE', aggregateVersion:3,
    });
    expect(await screen.findByRole('heading',{name:'Update Provider Account'})).toBeInTheDocument();
    expect(screen.getByDisplayValue('account-a')).toBeDisabled();
    expect(screen.getByDisplayValue('3')).toBeDisabled();

    await user.click(screen.getByRole('button',{name:'Update Provider Account'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai', action:'updateLlmProviderAccount', data:{
        hostId:'host-a', providerAccountId:'account-a', accountName:'OpenAI Production',
        providerType:'openai', billingPrincipal:'genai-cost-center',
        quotaGroupId:'openai-production', capacityMetadata:{serviceTier:'production'},
        lifecycleStatus:'ACTIVE', aggregateVersion:3,
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });
});
