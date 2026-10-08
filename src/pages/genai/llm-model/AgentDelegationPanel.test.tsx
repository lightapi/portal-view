import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,expect,it,vi} from 'vitest';
import AgentDelegationPanel from './AgentDelegationPanel';
const mocks=vi.hoisted(()=>({query:vi.fn(),command:vi.fn(),fetch:vi.fn()}));
vi.mock('./api',()=>({queryLlm:mocks.query,commandLlm:mocks.command}));
vi.mock('../../../utils/fetchClient',()=>({default:mocks.fetch}));
const requirements={'/v1/chat/completions@post':true,'/v1/responses@post':false,'/anthropic/v1/messages@post':false};
beforeEach(()=>{
 vi.clearAllMocks();
 mocks.fetch.mockResolvedValue({instances:[{instanceId:'gateway',instanceName:'Gateway',environment:'dev',envTag:'loc',productId:'gtw',readonly:false}]});
 mocks.query.mockImplementation(async(action:string)=>{
  if(action==='getLlmGatewaySecurityProfile') return [{securityProfileId:'profile',environment:'dev',userIssuer:'issuer',userAudience:'audience',aggregateVersion:4}];
  if(action==='getLlmGatewayDelegationPolicy') return [{instanceId:'gateway',securityProfileId:'profile',endpoints:requirements,aggregateVersion:7}];
  if(action==='getLlmGatewayOwnershipState') return {managed:true,instancePublicationId:'publication'};
  return {sourceDigest:'source',configProperties:[]};
 });
 mocks.command.mockResolvedValue(undefined);
});
it('saves explicit endpoint requirements with the observed version and keeps publication separate',async()=>{
 render(<AgentDelegationPanel hostId="host"/>);
 const checkbox=await screen.findByRole('checkbox',{name:'Require agent workload token: /v1/chat/completions@post'});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Save endpoint policy'})).toBeEnabled());
 await userEvent.click(checkbox);
 expect(screen.getByRole('button',{name:'Preview saved policy and derived bindings'})).toBeDisabled();
 await userEvent.click(screen.getByRole('button',{name:'Save endpoint policy'}));
 await waitFor(()=>expect(mocks.command).toHaveBeenCalledWith('updateLlmGatewayDelegationPolicy',{
  hostId:'host',instanceId:'gateway',securityProfileId:'profile',schemaVersion:1,aggregateVersion:7,
  endpoints:{...requirements,'/v1/chat/completions@post':false},
 }));
 expect(mocks.command.mock.calls).toHaveLength(1);
});
it('releases only the displayed managed publication and refreshes ownership',async()=>{
 vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<AgentDelegationPanel hostId="host" initialInstanceId="gateway"/>);
 await userEvent.click(await screen.findByRole('button',{name:'Release to generic configuration'}));
 await waitFor(()=>expect(mocks.command).toHaveBeenCalledWith('releaseLlmGatewayOwnership',{
  hostId:'host',instanceId:'gateway',instancePublicationId:'publication',
 }));
});
it('keeps the gateway selector available when entered from Instance Config',async()=>{
 render(<AgentDelegationPanel hostId="host" initialInstanceId="gateway"/>);
 await screen.findByDisplayValue('issuer');
 expect(screen.getByRole('combobox',{name:'Gateway instance'})).toBeEnabled();
 expect(screen.getByRole('checkbox',{name:'Require agent workload token: /v1/responses@post'})).not.toBeChecked();
});
it('derived binding links stay under the router basename',async()=>{
 const base=mocks.query.getMockImplementation()!;
 mocks.query.mockImplementation(async(action:string,data:unknown)=>action==='getLlmGatewayPublicationCandidate'
  ?{sourceDigest:'source',configProperties:[{propertyName:'agentDelegation',propertyValue:{bindings:[{clientId:'c/1',agentDefId:'a1'}]}}]}
  :base(action,data));
 render(<MemoryRouter basename="/ns/service/portal" initialEntries={['/ns/service/portal/app/genai/llmModel']}>
  <AgentDelegationPanel hostId="host" initialInstanceId="gateway"/></MemoryRouter>);
 const preview=await screen.findByRole('button',{name:'Preview saved policy and derived bindings'});
 await waitFor(()=>expect(preview).toBeEnabled());
 await userEvent.click(preview);
 expect(await screen.findByRole('link',{name:'Agent a1'})).toHaveAttribute('href','/ns/service/portal/app/genai/AgentDefinition?agentDefId=a1');
 expect(screen.getByRole('link',{name:'OAuth client c/1'})).toHaveAttribute('href','/ns/service/portal/app/oauth/authClient?clientId=c%2F1');
});
