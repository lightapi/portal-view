import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LlmModelCatalog from './LlmModelCatalog';

const mocks = vi.hoisted(() => ({
  fetchClient: vi.fn(),
  queryLlm: vi.fn(),
}));

vi.mock('../../contexts/UserContext', () => ({
  useUserState: () => ({host:'host-a',roles:'admin'}),
}));
vi.mock('../../utils/fetchClient', () => ({default:mocks.fetchClient}));
vi.mock('../genai/llm-model/api', () => ({queryLlm:mocks.queryLlm}));

function RouteResult() {
  return <output data-testid="route-result">{useLocation().pathname}</output>;
}

function renderCatalog() {
  return render(<MemoryRouter initialEntries={['/app/marketplace/llm-model']}><Routes>
    <Route path="/app/marketplace/llm-model" element={<LlmModelCatalog/>}/>
    <Route path="/app/genai/LlmModelControlPlane" element={<RouteResult/>}/>
    <Route path="/app/form/createLlmModel" element={<RouteResult/>}/>
  </Routes></MemoryRouter>);
}

describe('LLM model marketplace catalog', () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue([]);
    mocks.queryLlm.mockReset();
    mocks.queryLlm.mockResolvedValue([{
      hostId:'host-a', modelId:'model-a', providerType:'openai', physicalModelId:'gpt-a',
      modelFamily:'gpt', modelVersion:'1', lifecycleStatus:'ACTIVE', contextTokenLimit:128000,
      outputTokenLimit:4096, modalities:['text'], operations:['generate'], active:true,
    }]);
  });

  it('renders model cards instead of the admin resource table', async () => {
    renderCatalog();
    expect(screen.getByRole('heading',{name:'LLM Model Catalog'})).toBeInTheDocument();
    expect(await screen.findByRole('heading',{name:'gpt-a'})).toBeInTheDocument();
    expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Create LLM model'})).not.toBeInTheDocument();
    expect(mocks.queryLlm).toHaveBeenCalledWith('getLlmModel', {
      offset:0, limit:200, active:true,
    });
  });

  it('links administration and creation to the moved admin workflow', async () => {
    const user = userEvent.setup();
    const view = renderCatalog();
    await screen.findByText('gpt-a');
    await user.click(screen.getByRole('button',{name:'LLM Models Admin'}));
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/genai/LlmModelControlPlane');

    view.unmount();
    renderCatalog();
    await screen.findByText('gpt-a');
    await user.click(screen.getByRole('button',{name:'Create LLM Model'}));
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/form/createLlmModel');
  });

  it('filters models from the catalog search', async () => {
    const user = userEvent.setup();
    renderCatalog();
    await screen.findByText('gpt-a');
    await user.type(screen.getByRole('textbox',{name:'Search LLM models'}),'missing');
    await waitFor(() => expect(screen.getByText('No LLM models match the current catalog filters.')).toBeInTheDocument());
  });
});
