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

function renderRegistrationForm(formId:'createLlmRegistration'|'updateLlmRegistration',data:Record<string,unknown>) {
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

describe('LLM registration form routes', () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue({modelRegistrationId:'registration-a'});
    vi.stubGlobal('fetch',vi.fn().mockImplementation(async (request:RequestInfo|URL) => {
      const url = String(request);
      const values = url.includes('getLlmModelLabel') ? [{id:'model-a',label:'Model A'}]
        : url.includes('name=environment') ? ['prod']
          : url.includes('name=region') ? ['ca-central-1'] : [];
      return {json:async () => values, ok:true, status:200};
    }));
  });

  it('submits the create command with typed restrictions', async () => {
    const user = userEvent.setup();
    renderRegistrationForm('createLlmRegistration',{
      hostId:'host-a', modelId:'model-a', environment:'prod', regions:['ca-central-1'],
    });
    expect(await screen.findByRole('heading',{name:'Create LLM Registration'})).toBeInTheDocument();

    await waitFor(() => {
      const modelRequest = vi.mocked(fetch).mock.calls
        .map(([request]) => String(request))
        .find(url => url.includes('getLlmModelLabel'));
      expect(modelRequest).toBeDefined();
      const command = JSON.parse(new URLSearchParams(modelRequest!.split('?')[1]).get('cmd')!);
      expect(command).toMatchObject({
        service:'genai', action:'getLlmModelLabel', data:{filter:'',limit:200},
      });
      expect(command.data).not.toHaveProperty('hostId');
      expect(modelRequest).not.toContain('%7B0%7D');
    });

    await applyJson('Data Classifications',['internal','confidential']);
    await applyJson('Capability Restrictions',{tools:false,streaming:true});
    await user.click(screen.getByRole('button',{name:'Create LLM Registration'}));

    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai', action:'createLlmModelRegistration',
      data:{
        hostId:'host-a', modelId:'model-a', environment:'prod', regions:['ca-central-1'],
        dataClassifications:['internal','confidential'],
        capabilityRestrictions:{tools:false,streaming:true},
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('lifecycleStatus');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });

  it('retains update identity and optimistic-concurrency fields', async () => {
    const user = userEvent.setup();
    const existing = {
      hostId:'host-a', modelRegistrationId:'registration-a', modelId:'model-a', environment:'prod',
      regions:['ca-central-1'], dataClassifications:['confidential'],
      capabilityRestrictions:{tools:false}, aggregateVersion:4,
    };
    renderRegistrationForm('updateLlmRegistration',existing);
    expect(await screen.findByRole('heading',{name:'Update LLM Registration'})).toBeInTheDocument();
    expect(screen.getByDisplayValue('registration-a')).toBeDisabled();
    expect(screen.getByDisplayValue('4')).toBeDisabled();

    await user.click(screen.getByRole('button',{name:'Update LLM Registration'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai', action:'updateLlmModelRegistration', data:{
        hostId:'host-a', modelRegistrationId:'registration-a', modelId:'model-a', environment:'prod',
        regions:['ca-central-1'], dataClassifications:['confidential'],
        capabilityRestrictions:{tools:false}, aggregateVersion:4,
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });
});
