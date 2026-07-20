import { describe, expect, it } from 'vitest';
import { gatewaySupports, sanitizeForDisplay, validateMutation, validatePublicationCandidate } from './validation';
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
  it('requires complete captured conformance evidence in deployment publications', () => {
    const candidate = {environment:'prod',minimumGatewayVersion:'1.0.0',manifest:{},resources:[{
      resourceType:'llm-deployment',resourceId:'d',resourceVersion:1,sequence:1,schemaVersion:1,
      payload:{format:'openai',model:'gpt',conformanceDigest:'a'.repeat(64),conformanceResult:{
        schemaVersion:'1',provider:'openai',physicalModel:'gpt',state:'pass',validUntil:'2999-01-01T00:00:00Z',
        digest:'a'.repeat(64),capabilities:{operations:['chat_completions'],content:{text:true},streaming:false},
        capabilityEvidence:{chat_completions:{fixtureIds:['live'],provenances:['captured_sanitized']},
          text:{fixtureIds:['live'],provenances:['captured_sanitized']}},
      }},
    }]};
    expect(validatePublicationCandidate(candidate)).toHaveLength(0);
    (candidate.resources[0].payload.conformanceResult.capabilityEvidence.text.provenances as string[]) = ['synthetic_spec_derived'];
    expect(validatePublicationCandidate(candidate).join(' ')).toContain('captured_sanitized');
  });
  it('redacts raw secret-shaped fields from defensive UI rendering', () => {
    expect(sanitizeForDisplay({secretReference:'vault://safe',api_key:'sk-live',nested:{authorization:'Bearer live'}}))
      .toEqual({secretReference:'vault://safe',nested:{}});
  });
});
