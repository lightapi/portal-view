import { describe, expect, it } from 'vitest';
import { gatewaySupports, validateMutation, validatePublicationCandidate } from './validation';
import { llmResources } from './types';

describe('LLM model control-plane validation', () => {
  it('requires a host for mutable catalog rows', () => {
    expect(validateMutation(llmResources[0], {physicalModelId:'gpt'})).toContain('hostId is required.');
  });
  it('never accepts raw credential values', () => {
    const credential = llmResources.find(resource => resource.key === 'credentials')!;
    expect(validateMutation(credential,{hostId:'h',secret:'sk-secret',secretReference:'vault://x'}).join(' ')).toContain('Raw secrets');
    expect(validateMutation(credential,{hostId:'h',api_key:'sk-secret',secretReference:'vault://x'}).join(' ')).toContain('Raw secrets');
  });
  it('fails closed for unsupported route semantics and publication schemas', () => {
    const route = llmResources.find(resource => resource.key === 'routes')!;
    expect(validateMutation(route,{hostId:'h',routeWeight:2,canaryPercent:1})).not.toHaveLength(0);
    expect(validatePublicationCandidate({environment:'dev',minimumGatewayVersion:'1.0.0',manifest:{},resources:[{resourceType:'unknown'}]})).not.toHaveLength(0);
  });
  it('blocks publishing above the acknowledged compiler/features', () => {
    expect(gatewaySupports({minimumGatewayVersion:'2.0.0',enabledRoutingFeatures:['streaming']},{compilerVersion:'1.9.0',features:[]})).not.toHaveLength(0);
    expect(gatewaySupports({minimumGatewayVersion:'1.0.0',enabledRoutingFeatures:['streaming']},{compilerVersion:'1.1.0',features:['streaming']})).toHaveLength(0);
  });
  it('requires internal legacy aliases to bind to exactly one agent definition', () => {
    const alias = llmResources.find(resource => resource.key === 'aliases')!;
    expect(validateMutation(alias,{hostId:'h',aliasVisibility:'INTERNAL_LEGACY'}).join(' ')).toContain('boundAgentDefId');
    expect(validateMutation(alias,{hostId:'h',aliasVisibility:'INTERNAL_LEGACY',boundAgentDefId:'11111111-1111-4111-8111-111111111111'})).toHaveLength(0);
    expect(validateMutation(alias,{hostId:'h',aliasVisibility:'PUBLIC',boundAgentDefId:'11111111-1111-4111-8111-111111111111'}).join(' ')).toContain('cannot bind');
  });
});
