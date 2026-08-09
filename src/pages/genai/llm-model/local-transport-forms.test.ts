import { describe, expect, it } from 'vitest';
import forms from '../../../data/Forms.json';
import { llmAdminResources } from './types';

describe('LLM local transport forms', () => {
  it('wires first-class Network Zone and Provider Endpoint resources', () => {
    expect(llmAdminResources.find(resource => resource.key === 'networkZones')).toMatchObject({
      listAction:'getLlmNetworkZone',createForm:'createLlmNetworkZone',updateForm:'updateLlmNetworkZone',
    });
    expect(llmAdminResources.find(resource => resource.key === 'providerEndpoints')).toMatchObject({
      listAction:'getLlmProviderEndpoint',createForm:'createLlmProviderEndpoint',updateForm:'updateLlmProviderEndpoint',
    });
  });

  it('keeps trust and authentication material reference-only', () => {
    for (const formId of ['createLlmProviderEndpoint','updateLlmProviderEndpoint'] as const) {
      const properties = forms[formId].schema.properties;
      expect(properties).not.toHaveProperty('credential');
      expect(properties).not.toHaveProperty('secret');
      expect(properties).not.toHaveProperty('pem');
      expect(properties).not.toHaveProperty('signature');
      expect(properties.trustBundleReference.type).toEqual(['string','null']);
      expect(properties.trustBundleSha256.readonly).toBe(true);
      expect(properties.endpointAuthMode.enum).toEqual(['NONE','BEARER','API_KEY']);
    }
  });

  it('makes private plaintext risk and zone policy explicit', () => {
    const endpoint = forms.createLlmProviderEndpoint.schema.properties;
    expect(endpoint.networkProfileMode.enum).toEqual(['PUBLIC_TLS','PRIVATE_TLS','PRIVATE_PLAINTEXT']);
    expect(endpoint.plaintextRiskAcknowledged).toMatchObject({type:'boolean',default:false});
    const zone = forms.createLlmNetworkZone.schema.properties;
    expect(zone).toHaveProperty('cidrs');
    expect(zone).toHaveProperty('allowedPorts');
    expect(zone.allowPrivatePlaintext).toMatchObject({type:'boolean',default:false});
  });
});
