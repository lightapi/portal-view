import { describe, expect, it } from 'vitest';
import forms from '../../../data/Forms.json';
import { llmAdminResources } from './types';

type FormItem = string | {
  key?: string;
  type?: string;
  tabs?: string[];
  defaultTab?: string;
};

const policyObjectFields = [
  'accessPolicy','budgetPolicy','contentPolicy','cachePolicy','piiPolicy','nativeExtensionPolicy',
] as const;

describe('LLM model policy forms', () => {
  it('wires Policies to the create and update form routes', () => {
    const policies = llmAdminResources.find(resource => resource.key === 'policies');
    expect(policies).toMatchObject({createForm:'createModelPolicy',updateForm:'updateModelPolicy'});
    expect(policies?.formFields).toEqual([
      'hostId','modelPolicyId','policyName','accessPolicy','budgetPolicy','contentPolicy',
      'cachePolicy','piiPolicy','nativeExtensionPolicy','aggregateVersion',
    ]);
    expect(policies?.formFields).not.toContain('active');
  });

  it.each([
    ['createModelPolicy','createLlmModelPolicy','/help/portal-view/forms/create-model-policy'],
    ['updateModelPolicy','updateLlmModelPolicy','/help/portal-view/forms/update-model-policy'],
  ] as const)('defines %s with the policy command contract', (formId, action, helpPath) => {
    const definition = forms[formId];
    expect(definition.helpPath).toBe(helpPath);
    expect(definition.actions[0]).toMatchObject({
      service:'genai',action,success:'/app/genai/LlmModelControlPlane',
    });
    expect(definition.schema.additionalProperties).toBe(false);
    expect(definition.schema.properties).not.toHaveProperty('active');
    expect(definition.form).not.toContain('active');

    const items = definition.form as FormItem[];
    for (const field of policyObjectFields) {
      expect(definition.schema.properties[field]).toMatchObject({
        type:'object',additionalProperties:true,
      });
      expect(items.find(item => typeof item === 'object' && item.key === field)).toMatchObject({
        type:'structured',tabs:['form','json','yaml'],defaultTab:'json',
      });
    }
    expect(definition.schema.properties).not.toHaveProperty('lifecycleStatus');
  });

  it('applies create defaults and requires optimistic concurrency on update', () => {
    expect(forms.createModelPolicy.schema.required).toEqual(['hostId','policyName']);
    for (const field of policyObjectFields) {
      expect(forms.createModelPolicy.schema.properties[field].default).toEqual({});
    }
    expect(forms.updateModelPolicy.schema.required).toEqual([
      'hostId','modelPolicyId','aggregateVersion',
    ]);
    expect(forms.updateModelPolicy.schema.properties.modelPolicyId.readonly).toBe(true);
    expect(forms.updateModelPolicy.schema.properties.aggregateVersion).toMatchObject({
      type:'integer',readonly:true,minimum:1,
    });
  });
});
