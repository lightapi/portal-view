import { describe, expect, it } from 'vitest';
import forms from '../../../data/Forms.json';
import { llmAdminResources } from './types';

type FormItem = string | {
  key?: string;
  type?: string;
  multiple?: boolean;
  optionValueKey?: string;
  action?: {url?: string;params?: string[]};
};

describe('LLM policy binding forms', () => {
  it('wires Bindings to the create and update form routes', () => {
    const bindings = llmAdminResources.find(resource => resource.key === 'bindings');
    expect(bindings).toMatchObject({
      createForm:'createPolicyBinding',updateForm:'updatePolicyBinding',
    });
    expect(bindings?.formFields).toEqual([
      'hostId','modelPolicyBindingId','modelPolicyId','subjectType','subjectId',
      'publicAliasId','agentDefault','aggregateVersion',
    ]);
    expect(bindings?.formFields).not.toContain('active');
  });

  it.each([
    ['createPolicyBinding','createLlmModelPolicyBinding','/help/portal-view/forms/create-policy-binding'],
    ['updatePolicyBinding','updateLlmModelPolicyBinding','/help/portal-view/forms/update-policy-binding'],
  ] as const)('defines %s with the binding command contract', (formId, action, helpPath) => {
    const definition = forms[formId];
    expect(definition.helpPath).toBe(helpPath);
    expect(definition.actions[0]).toMatchObject({
      service:'genai',action,success:'/app/genai/LlmModelControlPlane',
    });
    expect(definition.schema.additionalProperties).toBe(false);
    expect(definition.schema.properties).not.toHaveProperty('active');
    expect(definition.form).not.toContain('active');
    expect(definition.schema.properties.subjectType.enum).toEqual([
      'AGENT','CLIENT','PRINCIPAL','PRODUCT_PROFILE',
    ]);
    expect(definition.schema.properties.subjectId).toMatchObject({type:'string',maxLength:255});
    expect(definition.schema.then).toMatchObject({
      properties:{subjectType:{const:'AGENT'}},required:['publicAliasId'],
    });

    const items = definition.form as FormItem[];
    const policy = items.find(item => typeof item === 'object' && item.key === 'modelPolicyId');
    expect(policy).toMatchObject({
      type:'dynaselect',multiple:false,optionValueKey:'id',action:{params:['hostId']},
    });
    expect(policy && typeof policy === 'object' ? policy.action?.url : '')
      .toContain('getLlmModelPolicyLabel');
    const alias = items.find(item => typeof item === 'object' && item.key === 'publicAliasId');
    expect(alias).toMatchObject({
      type:'dynaselect',multiple:false,optionValueKey:'id',action:{params:['hostId']},
    });
    expect(alias && typeof alias === 'object' ? alias.action?.url : '')
      .toContain('getLlmPublicAliasLabel');
  });

  it('requires the binding identity on create and optimistic concurrency on update', () => {
    expect(forms.createPolicyBinding.schema.required).toEqual([
      'hostId','modelPolicyId','subjectType','subjectId',
    ]);
    expect(forms.createPolicyBinding.schema.properties.subjectType.default).toBe('AGENT');
    expect(forms.createPolicyBinding.schema.properties.agentDefault.default).toBe(false);
    expect(forms.updatePolicyBinding.schema.required).toEqual([
      'hostId','modelPolicyBindingId','aggregateVersion',
    ]);
    expect(forms.updatePolicyBinding.schema.properties.modelPolicyBindingId.readonly).toBe(true);
    expect(forms.updatePolicyBinding.schema.properties.aggregateVersion).toMatchObject({
      type:'integer',readonly:true,minimum:1,
    });
  });
});
