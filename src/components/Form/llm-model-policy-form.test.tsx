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

const policies = {
  accessPolicy:{allowedSubjectTypes:['AGENT','CLIENT'],allowedOperations:['generate']},
  budgetPolicy:{maxCostMicrosPerRequest:500000,monthlyCostMicros:50000000},
  contentPolicy:{loggingMode:'METADATA',allowPromptLogging:false},
  cachePolicy:{enabled:false},
  piiPolicy:{mode:'REDACT',allowedKinds:['EMAIL']},
  nativeExtensionPolicy:{openai:{allowedRequestFields:['service_tier']}},
};

function RouteResult() {
  return <output data-testid="route-result">{useLocation().pathname}</output>;
}

function renderPolicyForm(formId:'createModelPolicy'|'updateModelPolicy',data:Record<string,unknown>) {
  return render(<MemoryRouter initialEntries={[{pathname:`/app/form/${formId}`,state:{data}}]}><Routes>
    <Route path="/app/form/:formId" element={<Form/>}/>
    <Route path="/app/genai/LlmModelControlPlane" element={<RouteResult/>}/>
    <Route path="/app/failure" element={<RouteResult/>}/>
  </Routes></MemoryRouter>);
}

async function applyJson(groupName:string,value:unknown) {
  const group = screen.getByRole('group',{name:groupName});
  await userEvent.click(within(group).getByRole('tab',{name:'JSON'}));
  fireEvent.change(within(group).getByRole('textbox',{name:`${groupName} JSON editor`}),{
    target:{value:JSON.stringify(value)},
  });
  await userEvent.click(within(group).getByRole('button',{name:'Apply'}));
}

describe('LLM model policy form routes', () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue({modelPolicyId:'policy-a'});
  });

  it('submits the create command with all policy domains', async () => {
    const user = userEvent.setup();
    renderPolicyForm('createModelPolicy',{hostId:'host-a',policyName:'governed-chat'});
    expect(await screen.findByRole('heading',{name:'Create Model Policy'})).toBeInTheDocument();
    await applyJson('Access Policy',policies.accessPolicy);
    await applyJson('Budget Policy',policies.budgetPolicy);
    await applyJson('Content Policy',policies.contentPolicy);
    await applyJson('Cache Policy',policies.cachePolicy);
    await applyJson('PII Policy',policies.piiPolicy);
    await applyJson('Native Extension Policy',policies.nativeExtensionPolicy);

    await user.click(screen.getByRole('button',{name:'Create Model Policy'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai',action:'createLlmModelPolicy',data:{
        hostId:'host-a',policyName:'governed-chat',...policies,lifecycleStatus:'DRAFT',
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });

  it('retains identity and submits policy changes on update', async () => {
    const user = userEvent.setup();
    renderPolicyForm('updateModelPolicy',{
      hostId:'host-a',modelPolicyId:'policy-a',policyName:'governed-chat',...policies,
      lifecycleStatus:'ACTIVE',aggregateVersion:4,
    });
    expect(await screen.findByRole('heading',{name:'Update Model Policy'})).toBeInTheDocument();
    expect(screen.getByDisplayValue('policy-a')).toBeDisabled();
    expect(screen.getByDisplayValue('4')).toBeDisabled();

    await user.click(screen.getByRole('button',{name:'Update Model Policy'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai',action:'updateLlmModelPolicy',data:{
        hostId:'host-a',modelPolicyId:'policy-a',policyName:'governed-chat',...policies,
        lifecycleStatus:'ACTIVE',aggregateVersion:4,
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });
});
