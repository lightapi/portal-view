import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LlmModelControlPlane from './LlmModelControlPlane';
import PublicationPanel from './PublicationPanel';
import ResourcePanel from './ResourcePanel';
import LlmModelCatalog from '../../marketplace/LlmModelCatalog';
import { llmResources } from './types';

const mocks = vi.hoisted(() => ({
  host: undefined as string | undefined,
  listLlm: vi.fn(),
  queryLlm: vi.fn(),
  commandLlm: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {...actual, useNavigate: () => mocks.navigate};
});

vi.mock('../../../contexts/UserContext', () => ({
  useUserState: () => ({host: mocks.host}),
}));
vi.mock('./api', () => ({
  listLlm: mocks.listLlm,
  queryLlm: mocks.queryLlm,
  commandLlm: mocks.commandLlm,
}));

const capturedEvidence = {
  fixtureIds: ['captured-chat'], provenances: ['captured_sanitized'],
};
const conformanceResult = {
  schemaVersion: '1', provider: 'openai', physicalModel: 'gpt-captured', state: 'pass',
  validUntil: '2999-01-01T00:00:00Z', digest: 'a'.repeat(64),
  capabilities: {
    operations: ['chat_completions'],
    content: {text: true, images: false, tools: false, parallelTools: false, structuredJson: false},
    streaming: false,
  },
  capabilityEvidence: {chat_completions: capturedEvidence, text: capturedEvidence},
};

const publication = (rollback = false) => ({
  environment: 'dev', publicationVersion: rollback ? 3 : 2, minimumGatewayVersion: '0.1.0',
  enabledRoutingFeatures: [], ...(rollback ? {rollbackOfPublicationId: 'prior-publication'} : {}),
  manifest: {schemaVersion: '1', resources: []},
  resources: [{
    schemaVersion: 1, resourceType: 'llm-deployment', resourceId: 'deployment-a',
    resourceVersion: 1, sequence: 2,
    payload: {
      format: 'openai', model: 'gpt-captured', conformanceDigest: 'a'.repeat(64),
      conformanceResult,
    },
  }],
});

describe('LLM control-plane wiring', () => {
  beforeEach(() => {
    mocks.host = undefined;
    mocks.listLlm.mockResolvedValue([]);
    mocks.queryLlm.mockResolvedValue(null);
    mocks.commandLlm.mockResolvedValue(undefined);
    mocks.navigate.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('reloads the active resource when the selected host changes', async () => {
    const view = render(<LlmModelControlPlane/>);
    expect(screen.getByText('Select a host to administer LLM models.')).toBeInTheDocument();
    mocks.host = 'host-a';
    view.rerender(<LlmModelControlPlane/>);
    await waitFor(() => expect(mocks.listLlm).toHaveBeenCalledWith('getLlmModelRegistration','host-a'));
    mocks.host = 'host-b';
    view.rerender(<LlmModelControlPlane/>);
    await waitFor(() => expect(mocks.listLlm).toHaveBeenCalledWith('getLlmModelRegistration','host-b'));
  });

  it('loads the model catalog from its Marketplace page', async () => {
    mocks.host = 'host-a';
    render(<LlmModelCatalog/>);
    expect(screen.getByRole('heading',{name:'LLM Model Catalog'})).toBeInTheDocument();
    await waitFor(() => expect(mocks.listLlm).toHaveBeenCalledWith('getLlmModel','host-a'));
    await userEvent.click(screen.getByRole('button',{name:'Create draft'}));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/form/createLlmModel', {
      state: {data: {hostId:'host-a',active:true}},
    });
  });

  it('opens typed model data for update without read-only audit fields', async () => {
    const model = {
      hostId:'host-a', modelId:'model-a', providerType:'openai', physicalModelId:'gpt-a',
      modelFamily:'gpt', lifecycleStatus:'ACTIVE', contextTokenLimit:128000,
      outputTokenLimit:4096, modalities:['text'], operations:['chat'],
      declaredCapabilities:{tools:true}, categoryIds:['category-a'], tagIds:['tag-a'],
      aggregateVersion:3, active:true, updateUser:'system', updateTs:'2026-07-21T00:00:00Z',
    };
    mocks.listLlm.mockResolvedValue([model]);
    const models = llmResources.find(resource => resource.key === 'models')!;
    render(<ResourcePanel hostId="host-a" resource={models}/>);
    await userEvent.click(await screen.findByLabelText('Edit'));

    expect(mocks.navigate).toHaveBeenCalledWith('/app/form/updateLlmModel', {
      state: {data: expect.objectContaining({
        modalities:['text'], operations:['chat'], declaredCapabilities:{tools:true},
        categoryIds:['category-a'], tagIds:['tag-a'], aggregateVersion:3,
      })},
    });
    const navigationData = mocks.navigate.mock.calls[0][1].state.data;
    expect(navigationData).not.toHaveProperty('updateUser');
    expect(navigationData).not.toHaveProperty('updateTs');
  });

  it('publishes and rolls back only complete captured-evidence roots', async () => {
    const user = userEvent.setup();
    const view = render(<PublicationPanel hostId="host-a"/>);
    const editor = screen.getByLabelText('Publication JSON');
    fireEvent.change(editor,{target:{value:JSON.stringify(publication(false))}});
    await user.click(screen.getByRole('button',{name:'Validate and publish'}));
    await waitFor(() => expect(mocks.commandLlm).toHaveBeenCalledWith(
      'publishLlmGatewayConfiguration', expect.objectContaining({hostId:'host-a',publicationVersion:2})));

    view.rerender(<PublicationPanel hostId="host-a"/>);
    fireEvent.change(screen.getByLabelText('Publication JSON'),{target:{value:JSON.stringify(publication(true))}});
    await user.click(screen.getByRole('button',{name:'Append rollback'}));
    await waitFor(() => expect(mocks.commandLlm).toHaveBeenCalledWith(
      'rollbackLlmGatewayConfiguration', expect.objectContaining({hostId:'host-a',publicationVersion:3})));
  });

  it('never renders or copies raw secret fields returned by a defensive backend', async () => {
    mocks.listLlm.mockResolvedValue([{
      hostId:'host-a', providerCredentialId:'credential-a', credentialVersion:1,
      secretReference:'vault://llm/credential-a', apiKey:'sk-live-must-not-render', aggregateVersion:1,
    }]);
    const credentials = llmResources.find(resource => resource.key === 'credentials')!;
    render(<ResourcePanel hostId="host-a" resource={credentials}/>);
    await screen.findByText('credential-a');
    expect(screen.queryByText(/sk-live-must-not-render/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Edit'));
    const dialog = screen.getByRole('dialog');
    expect((within(dialog).getByRole('textbox') as HTMLTextAreaElement).value)
      .not.toContain('sk-live-must-not-render');
  });

  it('previews governed alias eligibility without exposing provider material', async () => {
    mocks.listLlm.mockResolvedValue([{
      hostId:'host-a', publicAliasId:'alias-a', aliasName:'governed-chat',
      environment:'prod', lifecycleStatus:'ACTIVE', aggregateVersion:1,
    }]);
    mocks.queryLlm.mockResolvedValue([{deploymentId:'deployment-a',eligible:true}]);
    const aliases = llmResources.find(resource => resource.key === 'aliases')!;
    render(<ResourcePanel hostId="host-a" resource={aliases}/>);
    await userEvent.click(await screen.findByRole('button',{name:'Preview routes'}));
    await waitFor(() => expect(mocks.queryLlm).toHaveBeenCalledWith('previewLlmAliasRoutes',
      expect.objectContaining({hostId:'host-a',publicAliasId:'alias-a'})));
    expect(await screen.findByText(/deployment-a/)).toBeInTheDocument();
    expect(screen.queryByText(/baseUrl|credentialRef|secretReference/)).not.toBeInTheDocument();
  });
});
