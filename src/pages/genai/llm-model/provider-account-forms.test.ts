import { describe, expect, it } from 'vitest';
import forms from '../../../data/Forms.json';
import { llmAdminResources } from './types';

type FormItem = string | {
  key?: string;
  type?: string;
  multiple?: boolean;
  action?: {url?: string};
};

describe('LLM provider account forms', () => {
  it('wires the Accounts resource to the requested form routes', () => {
    const account = llmAdminResources.find(resource => resource.key === 'accounts');
    expect(account).toMatchObject({
      createForm:'createProviderAccount',
      updateForm:'updateProviderAccount',
    });
    expect(account?.formFields).toEqual(expect.arrayContaining([
      'hostId', 'providerAccountId', 'accountName', 'providerType',
      'billingPrincipal', 'quotaGroupId', 'capacityMetadata', 'aggregateVersion',
    ]));
    expect(account?.formFields).not.toContain('active');
  });

  it.each([
    ['createProviderAccount', 'createLlmProviderAccount'],
    ['updateProviderAccount', 'updateLlmProviderAccount'],
  ] as const)('defines %s with the backend command contract', (formId, action) => {
    const definition = forms[formId];
    expect(definition.actions[0]).toMatchObject({
      service:'genai', action, success:'/app/genai/LlmModelControlPlane',
    });
    expect(definition.schema.additionalProperties).toBe(false);
    expect(definition.schema.properties).not.toHaveProperty('active');
    expect(definition.form).not.toContain('active');
    expect(definition.schema.properties).not.toHaveProperty('lifecycleStatus');

    const items = definition.form as FormItem[];
    const provider = items.find(item => typeof item === 'object' && item.key === 'providerType');
    const capacity = items.find(item => typeof item === 'object' && item.key === 'capacityMetadata');
    expect(provider).toMatchObject({type:'dynaselect',multiple:false});
    expect(provider && typeof provider === 'object' ? provider.action?.url : '')
      .toBe('/r/data?name=model_provider');
    expect(capacity).toMatchObject({type:'structured'});
  });

  it('requires account ownership on create and optimistic concurrency on update', () => {
    expect(forms.createProviderAccount.schema.required).toEqual([
      'hostId','accountName','providerType','billingPrincipal','quotaGroupId',
    ]);
    expect(forms.updateProviderAccount.schema.required)
      .toEqual(['hostId','providerAccountId','aggregateVersion']);
    expect(forms.updateProviderAccount.schema.properties.providerAccountId.readonly).toBe(true);
    expect(forms.updateProviderAccount.schema.properties.aggregateVersion.readonly).toBe(true);
  });
});
