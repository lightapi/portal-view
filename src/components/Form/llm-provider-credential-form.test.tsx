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

function renderCredentialForm(
  formId:'createProviderCredential'|'updateProviderCredential',
  data:Record<string,unknown>,
) {
  return render(<MemoryRouter initialEntries={[{pathname:`/app/form/${formId}`,state:{data}}]}><Routes>
    <Route path="/app/form/:formId" element={<Form/>}/>
    <Route path="/app/genai/LlmModelControlPlane" element={<RouteResult/>}/>
    <Route path="/app/failure" element={<RouteResult/>}/>
  </Routes></MemoryRouter>);
}

describe('LLM provider credential form routes', () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue({providerCredentialId:'credential-a'});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
      json:async () => [{id:'deployment-a',label:'OpenAI GPT-4o Production'}],ok:true,status:200,
    }));
  });

  it('submits an external reference and activation window on create', async () => {
    const user = userEvent.setup();
    renderCredentialForm('createProviderCredential',{
      hostId:'host-a',providerDeploymentId:'deployment-a',credentialVersion:2,
      secretReference:'vault://llm/openai-production/api-key',
      effectiveTs:'2026-08-01T12:00:00Z',expiresTs:'2026-11-01T12:00:00Z',
    });
    expect(await screen.findByRole('heading',{name:'Create Provider Credential'})).toBeInTheDocument();

    await user.click(screen.getByRole('button',{name:'Create Provider Credential'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai',action:'createLlmProviderCredential',data:{
        hostId:'host-a',providerDeploymentId:'deployment-a',credentialVersion:2,
        secretReference:'vault://llm/openai-production/api-key',
        effectiveTs:'2026-08-01T12:00:00Z',expiresTs:'2026-11-01T12:00:00Z',
        lifecycleStatus:'PENDING',
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });

  it('retains immutable identity and optimistic-concurrency fields on update', async () => {
    const user = userEvent.setup();
    renderCredentialForm('updateProviderCredential',{
      hostId:'host-a',providerCredentialId:'credential-a',providerDeploymentId:'deployment-a',
      credentialVersion:2,secretReference:'vault://llm/openai-production/api-key',
      effectiveTs:'2026-08-01T12:00:00Z',expiresTs:'2026-11-01T12:00:00Z',
      lifecycleStatus:'ACTIVE',aggregateVersion:4,
    });
    expect(await screen.findByRole('heading',{name:'Update Provider Credential'})).toBeInTheDocument();
    expect(screen.getByDisplayValue('credential-a')).toBeDisabled();
    expect(screen.getByDisplayValue('4')).toBeDisabled();

    await user.click(screen.getByRole('button',{name:'Update Provider Credential'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai',action:'updateLlmProviderCredential',data:{
        hostId:'host-a',providerCredentialId:'credential-a',providerDeploymentId:'deployment-a',
        credentialVersion:2,secretReference:'vault://llm/openai-production/api-key',
        effectiveTs:'2026-08-01T12:00:00Z',expiresTs:'2026-11-01T12:00:00Z',
        lifecycleStatus:'ACTIVE',aggregateVersion:4,
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });
});
