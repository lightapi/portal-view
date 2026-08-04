import { render, screen, waitFor } from '@testing-library/react';
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

function renderBindingForm(formId:'createPolicyBinding'|'updatePolicyBinding',data:Record<string,unknown>) {
  return render(<MemoryRouter initialEntries={[{pathname:`/app/form/${formId}`,state:{data}}]}><Routes>
    <Route path="/app/form/:formId" element={<Form/>}/>
    <Route path="/app/genai/LlmModelControlPlane" element={<RouteResult/>}/>
    <Route path="/app/failure" element={<RouteResult/>}/>
  </Routes></MemoryRouter>);
}

describe('LLM policy binding form routes', () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue({modelPolicyBindingId:'binding-a'});
    vi.stubGlobal('fetch',vi.fn().mockImplementation(async (request:RequestInfo|URL) => {
      const url = String(request);
      const values = url.includes('getLlmModelPolicyLabel')
        ? [{id:'policy-a',label:'governed-chat-standard'}]
        : url.includes('getLlmPublicAliasLabel')
          ? [{id:'alias-a',label:'governed-chat'}] : [];
      return {json:async () => values,ok:true,status:200};
    }));
  });

  it('submits an agent-default binding on create', async () => {
    const user = userEvent.setup();
    renderBindingForm('createPolicyBinding',{
      hostId:'host-a',modelPolicyId:'policy-a',subjectType:'AGENT',
      subjectId:'10000000-0000-4000-8000-000000000099',
      publicAliasId:'alias-a',agentDefault:true,
    });
    expect(await screen.findByRole('heading',{name:'Create Policy Binding'})).toBeInTheDocument();

    await user.click(screen.getByRole('button',{name:'Create Policy Binding'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai',action:'createLlmModelPolicyBinding',data:{
        hostId:'host-a',modelPolicyId:'policy-a',subjectType:'AGENT',
        subjectId:'10000000-0000-4000-8000-000000000099',
        publicAliasId:'alias-a',agentDefault:true,
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });

  it('retains identity and submits a scoped principal binding on update', async () => {
    const user = userEvent.setup();
    renderBindingForm('updatePolicyBinding',{
      hostId:'host-a',modelPolicyBindingId:'binding-a',modelPolicyId:'policy-a',
      subjectType:'PRINCIPAL',subjectId:'user-1234',publicAliasId:'alias-a',
      agentDefault:false,aggregateVersion:3,
    });
    expect(await screen.findByRole('heading',{name:'Update Policy Binding'})).toBeInTheDocument();
    expect(screen.getByDisplayValue('binding-a')).toBeDisabled();
    expect(screen.getByDisplayValue('3')).toBeDisabled();

    await user.click(screen.getByRole('button',{name:'Update Policy Binding'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai',action:'updateLlmModelPolicyBinding',data:{
        hostId:'host-a',modelPolicyBindingId:'binding-a',modelPolicyId:'policy-a',
        subjectType:'PRINCIPAL',subjectId:'user-1234',publicAliasId:'alias-a',
        agentDefault:false,aggregateVersion:3,
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });
});
