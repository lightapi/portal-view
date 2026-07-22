import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import Form from './Form';

const mocks = vi.hoisted(() => ({
  fetchClient: vi.fn(),
}));

vi.mock('../../contexts/UserContext', () => ({
  useUserState: () => ({host: 'host-a', isAuthenticated: true}),
}));

vi.mock('../../utils/fetchClient', () => ({
  BASE_URL: '',
  default: mocks.fetchClient,
}));

vi.mock('../HelpLink', () => ({
  default: () => null,
}));

const requiredModel = {
  providerType: 'openai',
  physicalModelId: 'gpt-pilot',
  modelFamily: 'gpt',
  contextTokenLimit: 128000,
  outputTokenLimit: 4096,
};

function RouteResult() {
  const location = useLocation();
  return <output data-testid="route-result">{location.pathname}</output>;
}

function renderFormRoute(formId: 'createLlmModel' | 'updateLlmModel', data: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{
      pathname: `/app/form/${formId}`,
      state: {data},
    }]}>
      <Routes>
        <Route path="/app/form/:formId" element={<Form/>}/>
        <Route path="/app/marketplace/llm-model" element={<RouteResult/>}/>
        <Route path="/app/failure" element={<RouteResult/>}/>
      </Routes>
    </MemoryRouter>,
  );
}

function structuredGroup(name: string) {
  return screen.getByRole('group', {name});
}

async function applyJson(groupName: string, value: unknown) {
  const user = userEvent.setup();
  const group = structuredGroup(groupName);
  await user.click(within(group).getByRole('tab', {name: 'JSON'}));
  fireEvent.change(within(group).getByRole('textbox', {name: `${groupName} JSON editor`}), {
    target: {value: JSON.stringify(value)},
  });
  await user.click(within(group).getByRole('button', {name: 'Apply'}));
}

describe('LLM model form routes', () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue({modelId: 'model-a'});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => [],
      ok: true,
      status: 200,
    }));
  });

  it('renders the create route and submits structured values as typed data', async () => {
    const user = userEvent.setup();
    renderFormRoute('createLlmModel', requiredModel);

    expect(await screen.findByRole('heading', {name: 'Create LLM Model'})).toBeInTheDocument();
    const capabilities = structuredGroup('Declared Capabilities');
    expect(within(capabilities).getByRole('tab', {name: 'Form'})).toBeDisabled();
    expect(within(capabilities).getByRole('tab', {name: 'JSON'}))
      .toHaveAttribute('aria-selected', 'true');
    expect(within(structuredGroup('Modalities')).getByRole('tab', {name: 'Form'}))
      .toHaveAttribute('aria-selected', 'true');
    expect(within(structuredGroup('Operations')).getByRole('tab', {name: 'Form'}))
      .toHaveAttribute('aria-selected', 'true');

    await applyJson('Modalities', ['text', 'image']);
    await applyJson('Operations', ['chat_completions', 'embeddings']);
    await applyJson('Declared Capabilities', {streaming: true, tools: true});
    await user.click(screen.getByRole('button', {name: 'Create LLM Model'}));

    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    const action = mocks.fetchClient.mock.calls[0][1].body;
    expect(action.data).toMatchObject({
      modalities: ['text', 'image'],
      operations: ['chat_completions', 'embeddings'],
      declaredCapabilities: {streaming: true, tools: true},
    });
    expect(Array.isArray(action.data.modalities)).toBe(true);
    expect(Array.isArray(action.data.operations)).toBe(true);
    expect(typeof action.data.declaredCapabilities).toBe('object');
    expect(await screen.findByTestId('route-result'))
      .toHaveTextContent('/app/marketplace/llm-model');
  });

  it('loads existing structured values on the update route and submits them unchanged', async () => {
    const user = userEvent.setup();
    const existing = {
      ...requiredModel,
      hostId: 'host-a',
      modelId: 'model-a',
      aggregateVersion: 3,
      modalities: ['text'],
      operations: ['chat_completions'],
      declaredCapabilities: {streaming: true, tools: false},
      active: true,
    };
    renderFormRoute('updateLlmModel', existing);

    expect(await screen.findByRole('heading', {name: 'Update LLM Model'})).toBeInTheDocument();
    expect(within(structuredGroup('Declared Capabilities'))
      .getByRole('textbox', {name: 'Declared Capabilities JSON editor'}))
      .toHaveValue(JSON.stringify(existing.declaredCapabilities, null, 2));

    await user.click(within(structuredGroup('Modalities')).getByRole('tab', {name: 'JSON'}));
    expect(within(structuredGroup('Modalities'))
      .getByRole('textbox', {name: 'Modalities JSON editor'}))
      .toHaveValue(JSON.stringify(existing.modalities, null, 2));
    await user.click(within(structuredGroup('Operations')).getByRole('tab', {name: 'YAML'}));
    expect(within(structuredGroup('Operations'))
      .getByRole('textbox', {name: 'Operations YAML editor'}))
      .toHaveValue('- chat_completions\n');

    await user.click(screen.getByRole('button', {name: 'Update LLM Model'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    const action = mocks.fetchClient.mock.calls[0][1].body;
    expect(action.data).toMatchObject({
      modalities: existing.modalities,
      operations: existing.operations,
      declaredCapabilities: existing.declaredCapabilities,
    });
    expect(await screen.findByTestId('route-result'))
      .toHaveTextContent('/app/marketplace/llm-model');
  });

  it.each([
    ['JSON', '{"tools":'],
    ['YAML', 'tools: [broken'],
  ])('does not submit after an invalid %s draft fails Apply', async (format, draft) => {
    const user = userEvent.setup();
    renderFormRoute('createLlmModel', requiredModel);
    const capabilities = structuredGroup('Declared Capabilities');
    await user.click(within(capabilities).getByRole('tab', {name: format}));
    fireEvent.change(within(capabilities).getByRole('textbox', {
      name: `Declared Capabilities ${format} editor`,
    }), {target: {value: draft}});
    await user.click(within(capabilities).getByRole('button', {name: 'Apply'}));
    expect(within(capabilities).getByRole('textbox', {
      name: `Declared Capabilities ${format} editor`,
    })).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('button', {name: 'Create LLM Model'}));
    expect(mocks.fetchClient).not.toHaveBeenCalled();
    expect(screen.getByText(/Apply or Reset structured data changes/)).toBeInTheDocument();
  });

  it('does not submit an unapplied structured draft and recovers after Reset', async () => {
    const user = userEvent.setup();
    renderFormRoute('createLlmModel', requiredModel);
    const capabilities = structuredGroup('Declared Capabilities');
    const editor = within(capabilities).getByRole('textbox', {
      name: 'Declared Capabilities JSON editor',
    });
    fireEvent.change(editor, {target: {value: '{"tools":true}'}});

    await user.click(screen.getByRole('button', {name: 'Create LLM Model'}));
    expect(mocks.fetchClient).not.toHaveBeenCalled();

    await user.click(within(capabilities).getByRole('button', {name: 'Reset'}));
    await user.click(screen.getByRole('button', {name: 'Create LLM Model'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
  });
});
