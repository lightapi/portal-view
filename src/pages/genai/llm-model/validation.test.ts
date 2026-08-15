import { describe, expect, it } from 'vitest';
import { sanitizeForDisplay, validateMutation, validatePublicationCandidate } from './validation';
import { llmResources } from './types';

describe('LLM model control-plane validation', () => {
  it('requires a host for mutable catalog rows', () => {
    expect(validateMutation(llmResources[0], {physicalModelId:'gpt'})).toContain('hostId is required.');
  });
  it('never accepts raw credential values', () => {
    const credential = llmResources.find(resource => resource.key === 'credentials')!;
    expect(validateMutation(credential,{hostId:'h',secret:'sk-secret',secretReference:'vault://x'}).join(' ')).toContain('Raw secrets');
    expect(validateMutation(credential,{hostId:'h',api_key:'sk-secret',secretReference:'vault://x'}).join(' ')).toContain('Raw secrets');
    expect(validateMutation(credential,{hostId:'h',credentialPurpose:'ENDPOINT',providerEndpointId:'e',secretReference:'env:OPENAI_API_KEY'})).toHaveLength(0);
    expect(validateMutation(credential,{hostId:'h',secretReference:'env:invalid-name'})).not.toHaveLength(0);
  });
  it('validates Bedrock endpoint and reasoning-seal ownership as one typed contract', () => {
    const endpoint = llmResources.find(resource => resource.key === 'providerEndpoints')!;
    expect(validateMutation(endpoint,{hostId:'h',providerType:'aws_bedrock',providerProtocol:'bedrock_converse',
      awsRegion:'us-east-1',baseUrl:'https://bedrock-runtime.us-east-1.amazonaws.com',
      endpointAuthMode:'BEDROCK_API_KEY',networkProfileMode:'PUBLIC_TLS'})).toHaveLength(0);
    expect(validateMutation(endpoint,{hostId:'h',providerType:'aws_bedrock',providerProtocol:'openai_chat',
      awsRegion:'us-east-1',baseUrl:'https://bedrock-runtime.us-east-1.amazonaws.com',
      endpointAuthMode:'BEDROCK_API_KEY',networkProfileMode:'PUBLIC_TLS'})).not.toHaveLength(0);
    const credential = llmResources.find(resource => resource.key === 'credentials')!;
    expect(validateMutation(credential,{hostId:'h',credentialPurpose:'REASONING_SEAL',environment:'dev',
      reasoningKeyId:'reasoning-v1',reasoningKeyRole:'CURRENT',reasoningKeySetGeneration:1,
      reasoningKeySetState:'ACTIVE',secretReference:'env:LLM_REASONING_SEAL_KEY',
      reasoningStateLimits:{maxEncodedItemBytes:131072,maxDecodedProviderStateBytes:98304,
        maxItemsPerRequest:8,maxCumulativeEncodedBytes:262144,maxCumulativeDecodedBytes:196608}}))
      .toHaveLength(0);
  });
  it('fails closed for unsupported route semantics and publication schemas', () => {
    const route = llmResources.find(resource => resource.key === 'routes')!;
    expect(validateMutation(route,{hostId:'h',routeWeight:2,canaryPercent:1})).not.toHaveLength(0);
    expect(validatePublicationCandidate({environment:'dev',instanceId:'gateway-a'})).not.toHaveLength(0);
  });
  it('requires internal legacy aliases to bind to exactly one agent definition', () => {
    const alias = llmResources.find(resource => resource.key === 'aliases')!;
    expect(validateMutation(alias,{hostId:'h',aliasVisibility:'INTERNAL_LEGACY'}).join(' ')).toContain('boundAgentDefId');
    expect(validateMutation(alias,{hostId:'h',aliasVisibility:'INTERNAL_LEGACY',boundAgentDefId:'11111111-1111-4111-8111-111111111111'})).toHaveLength(0);
    expect(validateMutation(alias,{hostId:'h',aliasVisibility:'PUBLIC',boundAgentDefId:'11111111-1111-4111-8111-111111111111'}).join(' ')).toContain('cannot bind');
  });
  it('requires the complete generated instance property set without conformance evidence', () => {
    const names = ['enabled','developmentFixtures','providers','deployments','aliases','openaiExtensionAllowlist'];
    const candidate = {environment:'prod',instanceId:'gateway-a',sourceDigest:`sha256:${'a'.repeat(64)}`,
      propertySetDigest:`sha256:${'b'.repeat(64)}`,configProperties:names.map(propertyName => ({propertyName}))};
    expect(validatePublicationCandidate(candidate)).toHaveLength(0);
    candidate.configProperties.pop();
    expect(validatePublicationCandidate(candidate).join(' ')).toContain('openaiExtensionAllowlist');
  });
  it('redacts raw secret-shaped fields from defensive UI rendering', () => {
    expect(sanitizeForDisplay({secretReference:'vault://safe',api_key:'sk-live',nested:{authorization:'Bearer live'}}))
      .toEqual({secretReference:'vault://safe',nested:{}});
  });
});
