import { describe, expect, it } from 'vitest';
import forms from '../../../data/Forms.json';
import { llmAdminResources } from './types';

type FormItem = string | {
  key?: string;
  type?: string;
  multiple?: boolean;
  optionValueKey?: string;
  action?: {url?: string; params?: string[]};
};

describe('LLM provider credential forms', () => {
  it('wires the Credentials resource to the create and update form routes', () => {
    const credential = llmAdminResources.find(resource => resource.key === 'credentials');
    expect(credential).toMatchObject({
      createForm:'createProviderCredential',
      updateForm:'updateProviderCredential',
    });
    expect(credential?.formFields).toEqual([
      'hostId','providerCredentialId','providerDeploymentId','providerEndpointId','credentialPurpose','credentialVersion',
      'secretReference','effectiveTs','expiresTs','aggregateVersion',
    ]);
    expect(credential?.formFields).not.toContain('active');
  });

  it.each([
    ['createProviderCredential','createLlmProviderCredential','/help/portal-view/forms/create-provider-credential'],
    ['updateProviderCredential','updateLlmProviderCredential','/help/portal-view/forms/update-provider-credential'],
  ] as const)('defines %s with the credential command contract', (formId, action, helpPath) => {
    const definition = forms[formId];
    expect(definition.helpPath).toBe(helpPath);
    expect(definition.actions[0]).toMatchObject({
      service:'genai',action,success:'/app/genai/LlmModelControlPlane',
    });
    expect(definition.schema.additionalProperties).toBe(false);
    expect(definition.schema.properties).not.toHaveProperty('active');
    expect(definition.form).not.toContain('active');
    const secretReference = definition.schema.properties.secretReference;
    expect(secretReference).toMatchObject({type:'string',maxLength:1024});
    const secretReferencePattern = new RegExp(secretReference.pattern);
    expect(secretReferencePattern.test('env:OPENAI_API_KEY')).toBe(true);
    expect(secretReferencePattern.test('vault://llm/openai/api-key')).toBe(true);
    expect(secretReferencePattern.test('sk-raw-secret')).toBe(false);
    expect(secretReferencePattern.test('env:invalid-name')).toBe(false);
    expect(definition.schema.properties.effectiveTs).toMatchObject({type:'string',format:'date-time'});
    expect(definition.schema.properties.expiresTs)
      .toMatchObject({type:['string','null'],format:'date-time'});
  });

  it('uses the active Deployment label endpoint on both forms', () => {
    for (const formId of ['createProviderCredential','updateProviderCredential'] as const) {
      const items = forms[formId].form as FormItem[];
      const deployment = items.find(item => typeof item === 'object' && item.key === 'providerDeploymentId');
      expect(deployment).toMatchObject({
        type:'dynaselect',multiple:false,optionValueKey:'id',action:{params:['hostId']},
      });
      expect(deployment && typeof deployment === 'object' ? deployment.action?.url : '')
        .toContain('getLlmProviderDeploymentLabel');
    }
  });

  it('requires the credential identity and activation window', () => {
    expect(forms.createProviderCredential.schema.required).toEqual([
      'hostId','credentialPurpose','credentialVersion','secretReference','effectiveTs',
    ]);
    expect(forms.updateProviderCredential.schema.required).toEqual([
      'hostId','providerCredentialId','credentialPurpose','credentialVersion',
      'secretReference','effectiveTs','aggregateVersion',
    ]);
    for (const field of ['providerCredentialId','aggregateVersion'] as const) {
      expect(forms.updateProviderCredential.schema.properties[field].readonly).toBe(true);
    }
    for (const field of ['providerDeploymentId','providerEndpointId','credentialPurpose','credentialVersion','secretReference'] as const) {
      expect(forms.updateProviderCredential.schema.properties[field].readonly).not.toBe(true);
    }
  });
});
