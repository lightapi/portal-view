import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LlmModelControlPlane from './LlmModelControlPlane';
import PublicationPanel from './PublicationPanel';
import ResourcePanel from './ResourcePanel';
import { llmResources } from './types';

const mocks = vi.hoisted(() => ({
  host: undefined as string | undefined,
  roles: 'admin' as string | null,
  listLlm: vi.fn(),
  queryLlm: vi.fn(),
  commandLlm: vi.fn(),
  fetchClient: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {...actual, useNavigate: () => mocks.navigate};
});

vi.mock('../../../contexts/UserContext', () => ({
  useUserState: () => ({host: mocks.host,roles: mocks.roles}),
}));
vi.mock('./api', () => ({
  listLlm: mocks.listLlm,
  queryLlm: mocks.queryLlm,
  commandLlm: mocks.commandLlm,
}));
vi.mock('../../../utils/fetchClient', () => ({
  default: mocks.fetchClient,
}));

const publication = (environment = 'dev') => ({
  environment, instanceId:'instance-a',gatewayPublicationId:'revision-a',
  instancePublicationId:'application-a',publicationVersion:2,
  sourceDigest:`sha256:${'a'.repeat(64)}`,propertySetDigest:`sha256:${'b'.repeat(64)}`,
  configPropertiesDigest:`sha256:${'b'.repeat(64)}`,
  configProperties:[{propertyId:'property-a',propertyName:'providers',valueType:'map',propertyValue:{}}],
  differences:[], validationResult:{valid:true}, deliveryMode:'INSTANCE_PROPERTIES',
  validationResult:{valid:true}, deliveryMode:'IMMUTABLE_PROJECTION',
});

describe('LLM control-plane wiring', () => {
  beforeEach(() => {
    mocks.host = undefined;
    mocks.roles = 'admin';
    mocks.listLlm.mockResolvedValue([]);
    mocks.queryLlm.mockResolvedValue(null);
    mocks.commandLlm.mockResolvedValue(undefined);
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue([]);
    mocks.navigate.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('keeps the global model catalog stable when the selected host changes', async () => {
    const view = render(<LlmModelControlPlane/>);
    expect(screen.getByText('Global catalog shared by every host')).toBeInTheDocument();
    await waitFor(() => expect(mocks.listLlm).toHaveBeenCalledWith('getLlmModel',undefined));
    const calls = mocks.listLlm.mock.calls.length;
    mocks.host = 'host-a';
    view.rerender(<LlmModelControlPlane/>);
    mocks.host = 'host-b';
    view.rerender(<LlmModelControlPlane/>);
    await waitFor(() => expect(mocks.listLlm).toHaveBeenCalledTimes(calls));
  });

  it('shows a resource-specific create action on every admin tab', async () => {
    mocks.host = 'host-a';
    render(<LlmModelControlPlane/>);
    const labels = [
      ['LLM Models','Create LLM model'],
      ['Registrations','Create registration'],
      ['Accounts','Create provider account'],
      ['Deployments','Create provider deployment'],
      ['Credentials','Create provider credential'],
      ['Aliases','Create public alias'],
      ['Routes','Create alias route'],
      ['Pricing','Create pricing version'],
      ['Policies','Create model policy'],
      ['Bindings','Create policy binding'],
    ];

    for (const [tab, createLabel] of labels) {
      await userEvent.click(screen.getByRole('tab',{name:tab}));
      expect(screen.getByRole('button',{name:createLabel})).toBeInTheDocument();
    }
    expect(screen.queryByRole('button',{name:'Create draft'})).not.toBeInTheDocument();
  });

  it('shows model category and tag labels like the API admin table', async () => {
    mocks.host = 'host-a';
    mocks.listLlm.mockResolvedValue([{
      hostId:'host-a', modelId:'model-a', providerType:'openai', physicalModelId:'gpt-a',
      modelFamily:'gpt', categoryIds:['category-a'], tagIds:['tag-a'],     }]);
    mocks.fetchClient.mockImplementation(async (url:string) => {
      const command = JSON.parse(new URLSearchParams(url.split('?')[1]).get('cmd')!);
      return command.service === 'category'
        ? [{id:'category-a',label:'Foundation Models'}]
        : [{id:'tag-a',label:'Reasoning'}];
    });

    render(<LlmModelControlPlane/>);
    expect(await screen.findByRole('columnheader',{name:'Categories'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader',{name:'Tags'})).toBeInTheDocument();
    expect(await screen.findByText('Foundation Models')).toBeInTheDocument();
    expect(screen.getByText('Reasoning')).toBeInTheDocument();
    expect(screen.queryByText('category-a')).not.toBeInTheDocument();
    expect(screen.queryByText('tag-a')).not.toBeInTheDocument();
  });

  it('clears account rows and identifies the resource when the next tab fails to load', async () => {
    mocks.host = 'host-a';
    mocks.listLlm.mockImplementation(async (action:string) => {
      if (action === 'getLlmProviderAccount') return [{
        hostId:'host-a', providerAccountId:'account-a', accountName:'NVIDIA Demo',
        providerType:'nvidia', aggregateVersion:1,
      }];
      if (action === 'getLlmNetworkZone') return Promise.reject(undefined);
      return [];
    });

    render(<LlmModelControlPlane/>);
    await userEvent.click(screen.getByRole('tab',{name:'Accounts'}));
    expect(await screen.findByText('NVIDIA Demo')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab',{name:'Network Zones'}));
    expect(await screen.findByText(
      'Unable to load Network Zones. The server returned no error details.',
    )).toBeInTheDocument();
    expect(screen.queryByText('NVIDIA Demo')).not.toBeInTheDocument();
    expect(screen.getByText('No active records.')).toBeInTheDocument();
  });

  it('opens typed create and update forms from the Registrations tab', async () => {
    mocks.host = 'host-a';
    mocks.listLlm.mockImplementation(async (action:string) => action === 'getLlmModelRegistration' ? [{
      hostId:'host-a', modelRegistrationId:'registration-a', modelId:'model-a', providerType:'nvidia',
      physicalModelId:'nvidia/nemotron-3-embed-1b', environment:'prod',
      regions:['ca-central-1'], dataClassifications:['confidential'],
      capabilityRestrictions:{tools:false}, aggregateVersion:4, active:true,
      updateUser:'system', updateTs:'2026-07-31T00:00:00Z',
    }] : []);

    render(<LlmModelControlPlane/>);
    await userEvent.click(screen.getByRole('tab',{name:'Registrations'}));
    expect(await screen.findByRole('columnheader',{name:'Provider'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader',{name:'Physical Model'})).toBeInTheDocument();
    expect(await screen.findByText('nvidia')).toBeInTheDocument();
    expect(screen.getByText('nvidia/nemotron-3-embed-1b')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button',{name:'Create registration'}));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/form/createLlmRegistration', {
      state:{data:{hostId:'host-a'}},
    });

    mocks.navigate.mockClear();
    await userEvent.click(await screen.findByLabelText('Edit'));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/form/updateLlmRegistration', {
      state:{data:expect.objectContaining({
        modelRegistrationId:'registration-a', modelId:'model-a', environment:'prod',
        regions:['ca-central-1'], dataClassifications:['confidential'],
        capabilityRestrictions:{tools:false}, aggregateVersion:4,
      })},
    });
    const navigationData = mocks.navigate.mock.calls[0][1].state.data;
    expect(navigationData).not.toHaveProperty('updateUser');
    expect(navigationData).not.toHaveProperty('updateTs');
    expect(navigationData).not.toHaveProperty('active');
    expect(navigationData).not.toHaveProperty('providerType');
    expect(navigationData).not.toHaveProperty('physicalModelId');
  });

  it('opens typed model data for update without read-only audit fields', async () => {
    const model = {
      hostId:'host-a', modelId:'model-a', providerType:'openai', physicalModelId:'gpt-a',
      modelFamily:'gpt', contextTokenLimit:128000,
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
    expect(navigationData).not.toHaveProperty('hostId');
    expect(navigationData).not.toHaveProperty('updateUser');
    expect(navigationData).not.toHaveProperty('updateTs');
    expect(navigationData).not.toHaveProperty('active');
  });

  it('publishes a server-generated property set and can reapply an exact revision', async () => {
    const user = userEvent.setup();
    mocks.fetchClient.mockImplementation(async (url:string) => url.startsWith('/r/data?') ? [] : {
      instances:[{instanceId:'instance-a',instanceName:'Gateway A',productId:'gtw',environment:'dev',envTag:'dev'}],
    });
    mocks.queryLlm.mockImplementation((action: string) => {
      if (action === 'getLlmGatewayPublicationCandidate') return Promise.resolve(publication());
      if (action === 'getLlmGatewayInstancePublicationHistory') return Promise.resolve([publication()]);
      return Promise.resolve(null);
    });
    render(<PublicationPanel hostId="host-a"/>);
    await screen.findByText('Gateway A');
    await user.click(screen.getByRole('button',{name:'Generate from active records'}));
    await screen.findByLabelText('Generated llm-router properties');
    await user.click(screen.getByRole('button',{name:'Publish to instance'}));
    await waitFor(() => expect(mocks.commandLlm).toHaveBeenCalledWith(
      'publishLlmGatewayConfiguration', expect.objectContaining({hostId:'host-a',instanceId:'instance-a',expectedPropertySetDigest:`sha256:${'b'.repeat(64)}`})));
    await user.click(await screen.findByRole('button',{name:'Apply exact revision'}));
    await waitFor(() => expect(mocks.commandLlm).toHaveBeenCalledWith(
      'rollbackLlmGatewayConfiguration', expect.objectContaining({hostId:'host-a',gatewayPublicationId:'revision-a',rollbackOfInstancePublicationId:'application-a'})));
    expect(screen.getByRole('button',{name:'Apply exact revision'})).toBeInTheDocument();
  });

  it('uses the selected instance logical environment rather than its env tag for generation', async () => {
    const user = userEvent.setup();
    mocks.fetchClient.mockImplementation(async (url:string) => url.startsWith('/r/data?') ? ['loc'] : {
      instances:[{instanceId:'instance-a',instanceName:'portal-bff-loc',productId:'gtw',environment:'dev',envTag:'loc'}],
    });
    mocks.queryLlm.mockImplementation((action: string) => {
      if (action === 'getLlmGatewayPublicationCandidate') {
        return Promise.resolve(publication('dev'));
      }
      if (action === 'getLlmGatewayInstancePublicationHistory') {
        return Promise.resolve([{...publication('dev'),updateTs:'2026-08-01T00:00:00Z',updateUser:'operator'}]);
      }
      return Promise.resolve(null);
    });

    render(<PublicationPanel hostId="host-a"/>);
    await waitFor(() => expect(screen.getByLabelText('Instance Env Tag')).toHaveTextContent('loc'));
    expect(await screen.findByText('dev',{selector:'code'})).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Generate from active records'}));
    await waitFor(() => expect(mocks.queryLlm).toHaveBeenCalledWith(
      'getLlmGatewayPublicationCandidate',{hostId:'host-a',environment:'dev',instanceId:'instance-a'}));
    expect((screen.getByLabelText('Generated llm-router properties') as HTMLTextAreaElement).value).toContain('"propertyName": "providers"');
    expect(await screen.findByRole('button',{name:'Apply exact revision'})).toBeInTheDocument();
  });

  it('loads every gtw instance for the selected env tag into the publication dropdown', async () => {
    const user = userEvent.setup();
    mocks.fetchClient.mockImplementation(async (url:string) => {
      if (url.startsWith('/r/data?')) return ['dev'];
      return {instances:[
        {instanceId:'gateway-a',instanceName:'Gateway A',productId:'gtw',environment:'dev',envTag:'dev'},
        {instanceId:'gateway-b',instanceName:'Gateway B',productId:'GTW',environment:'dev',envTag:'DEV'},
        {instanceId:'gateway-qa',instanceName:'QA Gateway',productId:'gtw',environment:'dev',envTag:'qa'},
        {instanceId:'other-dev',instanceName:'Other Product',productId:'lg',environment:'dev',envTag:'dev'},
      ]};
    });

    render(<PublicationPanel hostId="host-a"/>);

    expect(await screen.findByText('Gateway A')).toBeInTheDocument();
    await user.click(screen.getByLabelText('LLM Gateway Instance'));
    expect(screen.getByRole('option',{name:'Gateway A'})).toBeInTheDocument();
    expect(screen.getByRole('option',{name:'Gateway B'})).toBeInTheDocument();
    expect(screen.queryByRole('option',{name:'QA Gateway'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option',{name:'Other Product'})).not.toBeInTheDocument();
    const instanceUrl = String(mocks.fetchClient.mock.calls.find(([url]) =>
      String(url).startsWith('/portal/query?'))?.[0]);
    const command = JSON.parse(new URLSearchParams(instanceUrl.split('?')[1]).get('cmd')!);
    expect(command).toMatchObject({service:'instance',action:'getInstance',data:{hostId:'host-a',limit:1000,active:true}});
    expect(JSON.parse(command.data.filters)).toEqual([
      {id:'productId',value:'gtw'},
      {id:'envTag',value:'dev'},
    ]);
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
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/app/form/updateProviderCredential',{
      state:{data:expect.objectContaining({
        hostId:'host-a',providerCredentialId:'credential-a',credentialVersion:1,
        secretReference:'vault://llm/credential-a',aggregateVersion:1,
      })},
    }));
    expect(mocks.navigate.mock.calls[0][1].state.data).not.toHaveProperty('apiKey');
  });

  it('previews governed alias eligibility without exposing provider material', async () => {
    mocks.listLlm.mockResolvedValue([{
      hostId:'host-a', publicAliasId:'alias-a', aliasName:'governed-chat',
      environment:'prod', aggregateVersion:1,
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
