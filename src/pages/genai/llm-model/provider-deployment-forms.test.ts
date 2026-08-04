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

describe('LLM provider deployment forms', () => {
  it('wires the Deployments resource to the requested form routes', () => {
    const deployment = llmAdminResources.find(resource => resource.key === 'deployments');
    expect(deployment).toMatchObject({
      createForm:'createProviderDeployment',
      updateForm:'updateProviderDevelopment',
    });
    expect(deployment?.formFields).toEqual(expect.arrayContaining([
      'hostId', 'providerDeploymentId', 'modelRegistrationId', 'providerAccountId',
      'deploymentName', 'providerType', 'physicalModelId', 'baseUrl', 'region',
      'transportBounds', 'refreshBeforeSeconds',
      'lifecycleStatus', 'aggregateVersion',
    ]));
    expect(deployment?.formFields).not.toContain('active');
  });

  it.each([
    ['createProviderDeployment', 'createLlmProviderDeployment', '/help/portal-view/forms/create-provider-deployment'],
    ['updateProviderDevelopment', 'updateLlmProviderDeployment', '/help/portal-view/forms/update-provider-development'],
  ] as const)('defines %s with the backend contract', (formId, action, helpPath) => {
    const definition = forms[formId];
    expect(definition).toMatchObject({formId,helpPath});
    expect(definition.actions[0]).toMatchObject({
      service:'genai', action, success:'/app/genai/LlmModelControlPlane',
    });
    expect(definition.schema.additionalProperties).toBe(false);
    expect(definition.schema.properties).not.toHaveProperty('active');
    expect(definition.form).not.toContain('active');
    for (const field of ['quotaGroupId','conformanceState','conformanceDigest','conformanceValidUntil','conformanceResult']) {
      expect(definition.schema.properties).not.toHaveProperty(field);
      expect(definition.form).not.toContain(field);
    }

    const items = definition.form as FormItem[];
    const registration = items.find(item => typeof item === 'object' && item.key === 'modelRegistrationId');
    const account = items.find(item => typeof item === 'object' && item.key === 'providerAccountId');
    const provider = items.find(item => typeof item === 'object' && item.key === 'providerType');
    const model = items.find(item => typeof item === 'object' && item.key === 'physicalModelId');
    const region = items.find(item => typeof item === 'object' && item.key === 'region');
    const bounds = items.find(item => typeof item === 'object' && item.key === 'transportBounds');
    expect(registration).toMatchObject({type:'dynaselect',multiple:false,optionValueKey:'id'});
    expect(account).toMatchObject({type:'dynaselect',multiple:false,optionValueKey:'id'});
    expect(decodeURIComponent(registration && typeof registration === 'object' ? registration.action?.url ?? '' : ''))
      .toContain('getLlmModelRegistrationLabel');
    expect(decodeURIComponent(account && typeof account === 'object' ? account.action?.url ?? '' : ''))
      .toContain('getLlmProviderAccountLabel');
    expect(provider).toMatchObject({type:'dynaselect',multiple:false});
    expect(model).toMatchObject({type:'dynaselect',multiple:false,action:{params:['providerType']}});
    expect(region).toMatchObject({type:'dynaselect',multiple:false,action:{params:['hostId']}});
    expect(bounds).toMatchObject({type:'structured'});
  });

  it('requires the callable binding on create and optimistic concurrency on update', () => {
    expect(forms.createProviderDeployment.schema.required).toEqual([
      'hostId','modelRegistrationId','providerAccountId','deploymentName',
      'providerType','physicalModelId','baseUrl',
    ]);
    expect(forms.createProviderDeployment.schema.properties.lifecycleStatus.enum).toEqual(['DRAFT']);
    expect(forms.updateProviderDevelopment.schema.properties.lifecycleStatus.enum)
      .toEqual(['DRAFT','VALIDATING','ACTIVE','SUSPENDED','RETIRED']);
    expect(forms.updateProviderDevelopment.schema.required)
      .toEqual(['hostId','providerDeploymentId','aggregateVersion']);
    expect(forms.updateProviderDevelopment.schema.properties.providerDeploymentId.readonly).toBe(true);
    expect(forms.updateProviderDevelopment.schema.properties.aggregateVersion.readonly).toBe(true);
  });
});
