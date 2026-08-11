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

function renderAliasForm(formId:'createPublicAlias'|'updatePublicAlias',data:Record<string,unknown>) {
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

describe('LLM public alias form routes', () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue({publicAliasId:'alias-a'});
    vi.stubGlobal('fetch',vi.fn().mockImplementation(async (request:RequestInfo|URL) => {
      const url = String(request);
      const values = url.includes('getLlmPublicAliasLabel')
        ? [{id:'alias-b',label:'governed-chat-v2'}]
        : url.includes('getAgentDefinitionLabel')
          ? [{id:'10000000-0000-4000-8000-000000000099',label:'Legacy Support Agent'}]
          : url.includes('name=environment') ? ['prod','dev'] : [];
      return {json:async () => values,ok:true,status:200};
    }));
  });

  it('submits the create command with typed policy fields', async () => {
    const user = userEvent.setup();
    renderAliasForm('createPublicAlias',{
      hostId:'host-a',environment:'prod',aliasName:'governed-chat',
      maxInputTokens:128000,maxOutputTokens:8192,maxRequestBytes:1048576,
      dataClassification:'internal',loggingMode:'METADATA',piiMode:'REDACT',
    });
    expect(await screen.findByRole('heading',{name:'Create Public Alias'})).toBeInTheDocument();
    await applyJson('Operations',['generate']);
    await applyJson('Required Capabilities',{tools:true,streaming:true});

    await user.click(screen.getByRole('button',{name:'Create Public Alias'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai',action:'createLlmPublicAlias',data:{
        hostId:'host-a',environment:'prod',aliasName:'governed-chat',
        operations:['generate'],requiredCapabilities:{tools:true,streaming:true},
        maxInputTokens:128000,maxOutputTokens:8192,maxRequestBytes:1048576,
        dataClassification:'internal',loggingMode:'METADATA',piiMode:'REDACT',
        aliasVisibility:'PUBLIC',
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('lifecycleStatus');
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('boundAgentDefId');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });

  it('retains identity and submits an agent-bound internal alias on update', async () => {
    const user = userEvent.setup();
    renderAliasForm('updatePublicAlias',{
      hostId:'host-a',publicAliasId:'alias-a',environment:'prod',aliasName:'legacy-agent-chat',
      operations:['generate'],requiredCapabilities:{
        tools:true,
        embeddingSpace:{spaceId:'old-space',revision:1,dimension:768,normalization:'l2',
          distanceMetric:'cosine',documentInputTransformVersion:'document-v1'},
      },maxInputTokens:64000,
      maxOutputTokens:4096,maxRequestBytes:524288,dataClassification:null,
      loggingMode:'REDACTED',piiMode:'TOKENIZE',
      replacementAliasId:'alias-b',aliasVisibility:'INTERNAL_LEGACY',
      boundAgentDefId:'10000000-0000-4000-8000-000000000099',aggregateVersion:6,
    });
    expect(await screen.findByRole('heading',{name:'Update Public Alias'})).toBeInTheDocument();
    expect(screen.getByDisplayValue('alias-a')).toBeDisabled();
    expect(screen.getByDisplayValue('6')).toBeDisabled();

    await user.click(screen.getByRole('button',{name:'Update Public Alias'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai',action:'updateLlmPublicAlias',data:{
        hostId:'host-a',publicAliasId:'alias-a',environment:'prod',aliasName:'legacy-agent-chat',
        requiredCapabilities:{tools:true},maxInputTokens:64000,
        maxOutputTokens:4096,maxRequestBytes:524288,dataClassification:null,
        loggingMode:'REDACTED',piiMode:'TOKENIZE',
        replacementAliasId:'alias-b',aliasVisibility:'INTERNAL_LEGACY',
        boundAgentDefId:'10000000-0000-4000-8000-000000000099',aggregateVersion:6,
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('operations');
    expect(mocks.fetchClient.mock.calls[0][1].body.data.requiredCapabilities)
      .not.toHaveProperty('embeddingSpace');
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });

  it('submits a null binding when updating a public alias', async () => {
    const user = userEvent.setup();
    renderAliasForm('updatePublicAlias',{
      hostId:'host-a',publicAliasId:'alias-a',environment:'prod',aliasName:'governed-chat',
      maxInputTokens:null,maxOutputTokens:null,maxRequestBytes:null,
      replacementAliasId:null,aliasVisibility:'PUBLIC',boundAgentDefId:null,aggregateVersion:5,
    });
    expect(await screen.findByRole('heading',{name:'Update Public Alias'})).toBeInTheDocument();

    await user.click(screen.getByRole('button',{name:'Update Public Alias'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body.data).toMatchObject({
      hostId:'host-a',publicAliasId:'alias-a',aliasVisibility:'PUBLIC',
      maxInputTokens:null,maxOutputTokens:null,maxRequestBytes:null,
      replacementAliasId:null,boundAgentDefId:null,aggregateVersion:5,
    });
  });
});
