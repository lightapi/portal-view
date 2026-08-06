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

function renderPricingForm(formId:'createPricingVersion'|'updatePricingVersion',data:Record<string,unknown>) {
  return render(<MemoryRouter initialEntries={[{pathname:`/app/form/${formId}`,state:{data}}]}><Routes>
    <Route path="/app/form/:formId" element={<Form/>}/>
    <Route path="/app/genai/LlmModelControlPlane" element={<RouteResult/>}/>
    <Route path="/app/failure" element={<RouteResult/>}/>
  </Routes></MemoryRouter>);
}

describe('LLM pricing version form routes', () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue({pricingVersionId:'pricing-a'});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
      json:async () => [{id:'deployment-a',label:'openai-prod-ca'}],ok:true,status:200,
    }));
  });

  it('submits effective approved rates on create', async () => {
    const user = userEvent.setup();
    renderPricingForm('createPricingVersion',{
      hostId:'host-a',providerDeploymentId:'deployment-a',pricingVersion:3,
      inputMicrosPerMillion:2500000,outputMicrosPerMillion:10000000,
      cachedInputMicrosPerMillion:1250000,effectiveTs:'2026-08-01T12:00:00Z',
      expiresTs:null,source:'provider-contract-2026-08',
      approvedBy:'finops@example.com',
    });
    expect(await screen.findByRole('heading',{name:'Create Pricing Version'})).toBeInTheDocument();

    await user.click(screen.getByRole('button',{name:'Create Pricing Version'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai',action:'createLlmPricingVersion',data:{
        hostId:'host-a',providerDeploymentId:'deployment-a',pricingVersion:3,
        inputMicrosPerMillion:2500000,outputMicrosPerMillion:10000000,
        cachedInputMicrosPerMillion:1250000,effectiveTs:'2026-08-01T12:00:00Z',
        expiresTs:null,source:'provider-contract-2026-08',
        approvedBy:'finops@example.com',
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });

  it('retains identity and submits pricing changes on update', async () => {
    const user = userEvent.setup();
    renderPricingForm('updatePricingVersion',{
      hostId:'host-a',pricingVersionId:'pricing-a',providerDeploymentId:'deployment-a',
      pricingVersion:3,inputMicrosPerMillion:2500000,outputMicrosPerMillion:10000000,
      cachedInputMicrosPerMillion:1250000,effectiveTs:'2026-08-01T12:00:00Z',
      expiresTs:null,source:'provider-contract-2026-08',
      approvedBy:'finops@example.com',aggregateVersion:4,
    });
    expect(await screen.findByRole('heading',{name:'Update Pricing Version'})).toBeInTheDocument();
    expect(screen.getByDisplayValue('pricing-a')).toBeDisabled();
    expect(screen.getByDisplayValue('4')).toBeDisabled();

    await user.click(screen.getByRole('button',{name:'Update Pricing Version'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
      service:'genai',action:'updateLlmPricingVersion',data:{
        hostId:'host-a',pricingVersionId:'pricing-a',providerDeploymentId:'deployment-a',
        pricingVersion:3,inputMicrosPerMillion:2500000,outputMicrosPerMillion:10000000,
        cachedInputMicrosPerMillion:1250000,effectiveTs:'2026-08-01T12:00:00Z',
        expiresTs:null,source:'provider-contract-2026-08',
        approvedBy:'finops@example.com',aggregateVersion:4,
      },
    });
    expect(mocks.fetchClient.mock.calls[0][1].body.data).not.toHaveProperty('active');
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');
  });
});
