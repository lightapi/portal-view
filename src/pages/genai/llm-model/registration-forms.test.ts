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

describe('LLM registration forms', () => {
  it('wires the Registrations resource to the requested form routes', () => {
    const registration = llmAdminResources.find(resource => resource.key === 'registrations');
    expect(registration).toMatchObject({
      createForm:'createLlmRegistration',
      updateForm:'updateLlmRegistration',
    });
    expect(registration?.formFields).toEqual(expect.arrayContaining([
      'modelRegistrationId', 'modelId', 'environment', 'regions',
      'dataClassifications', 'capabilityRestrictions', 'aggregateVersion',
    ]));
  });

  it.each([
    ['createLlmRegistration', 'createLlmModelRegistration'],
    ['updateLlmRegistration', 'updateLlmModelRegistration'],
  ] as const)('defines %s with the backend command contract', (formId, action) => {
    const definition = forms[formId];
    expect(definition.actions[0]).toMatchObject({
      service:'genai', action, success:'/app/genai/LlmModelControlPlane',
    });
    expect(definition.schema.additionalProperties).toBe(false);
    expect(definition.schema.properties).not.toHaveProperty('active');
    expect(definition.form).not.toContain('active');
    expect(definition.schema.properties.lifecycleStatus.enum)
      .toEqual(['DRAFT','ACTIVE','SUSPENDED','RETIRED']);

    const items = definition.form as FormItem[];
    const model = items.find(item => typeof item === 'object' && item.key === 'modelId');
    const regions = items.find(item => typeof item === 'object' && item.key === 'regions');
    const classifications = items.find(item => typeof item === 'object' && item.key === 'dataClassifications');
    const restrictions = items.find(item => typeof item === 'object' && item.key === 'capabilityRestrictions');
    expect(model).toMatchObject({type:'dynaselect',multiple:false,optionValueKey:'id'});
    expect(decodeURIComponent(model && typeof model === 'object' ? model.action?.url ?? '' : ''))
      .toContain('getLlmModelLabel');
    expect(model && typeof model === 'object' ? model.action?.url : '')
      .not.toContain('hostId');
    expect(model && typeof model === 'object' ? model.action?.params : undefined)
      .toBeUndefined();
    expect(model && typeof model === 'object' ? model.action?.url : '')
      .not.toContain('%7B0%7D');
    expect(regions).toMatchObject({type:'dynaselect',multiple:true});
    expect(classifications).toMatchObject({type:'structured'});
    expect(restrictions).toMatchObject({type:'structured'});
  });

  it('requires identity on create and optimistic concurrency on update', () => {
    expect(forms.createLlmRegistration.schema.required).toEqual(['hostId','modelId','environment']);
    expect(forms.updateLlmRegistration.schema.required)
      .toEqual(['hostId','modelRegistrationId','aggregateVersion']);
    expect(forms.updateLlmRegistration.schema.properties.modelRegistrationId.readonly).toBe(true);
    expect(forms.updateLlmRegistration.schema.properties.aggregateVersion.readonly).toBe(true);
  });
});
