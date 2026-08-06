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

describe('LLM pricing version forms', () => {
  it('wires Pricing to the create and update form routes', () => {
    const pricing = llmAdminResources.find(resource => resource.key === 'pricing');
    expect(pricing).toMatchObject({
      createForm:'createPricingVersion',updateForm:'updatePricingVersion',
    });
    expect(pricing?.formFields).toEqual([
      'hostId','pricingVersionId','providerDeploymentId','pricingVersion',
      'inputMicrosPerMillion','outputMicrosPerMillion','cachedInputMicrosPerMillion',
      'effectiveTs','expiresTs','source','approvedBy','aggregateVersion',
    ]);
    expect(pricing?.formFields).not.toContain('active');
  });

  it.each([
    ['createPricingVersion','createLlmPricingVersion','/help/portal-view/forms/create-pricing-version'],
    ['updatePricingVersion','updateLlmPricingVersion','/help/portal-view/forms/update-pricing-version'],
  ] as const)('defines %s with the pricing command contract', (formId, action, helpPath) => {
    const definition = forms[formId];
    expect(definition.helpPath).toBe(helpPath);
    expect(definition.actions[0]).toMatchObject({
      service:'genai',action,success:'/app/genai/LlmModelControlPlane',
    });
    expect(definition.schema.additionalProperties).toBe(false);
    expect(definition.schema.properties).not.toHaveProperty('active');
    expect(definition.form).not.toContain('active');
    for (const field of ['inputMicrosPerMillion','outputMicrosPerMillion','cachedInputMicrosPerMillion'] as const) {
      expect(definition.schema.properties[field]).toMatchObject({type:'integer',minimum:0});
    }
    expect(definition.schema.properties.pricingVersion).toMatchObject({type:'integer',minimum:1});
    expect(definition.schema.properties.effectiveTs).toMatchObject({type:'string',format:'date-time'});
    expect(definition.schema.properties.expiresTs)
      .toMatchObject({type:['string','null'],format:'date-time'});

    const items = definition.form as FormItem[];
    const deployment = items.find(item => typeof item === 'object' && item.key === 'providerDeploymentId');
    expect(deployment).toMatchObject({
      type:'dynaselect',multiple:false,optionValueKey:'id',action:{params:['hostId']},
    });
    expect(deployment && typeof deployment === 'object' ? deployment.action?.url : '')
      .toContain('getLlmProviderDeploymentLabel');
    expect(items.find(item => typeof item === 'object' && item.key === 'effectiveTs'))
      .toMatchObject({type:'timestamp'});
    expect(items.find(item => typeof item === 'object' && item.key === 'expiresTs'))
      .toMatchObject({type:'timestamp'});
  });

  it('requires effective approved rates on create and optimistic concurrency on update', () => {
    expect(forms.createPricingVersion.schema.required).toEqual([
      'hostId','providerDeploymentId','pricingVersion','inputMicrosPerMillion',
      'outputMicrosPerMillion','effectiveTs','source','approvedBy',
    ]);
    expect(forms.updatePricingVersion.schema.required).toEqual([
      'hostId','pricingVersionId','aggregateVersion',
    ]);
    expect(forms.updatePricingVersion.schema.properties.pricingVersionId.readonly).toBe(true);
    expect(forms.updatePricingVersion.schema.properties.aggregateVersion.readonly).toBe(true);
  });
});
