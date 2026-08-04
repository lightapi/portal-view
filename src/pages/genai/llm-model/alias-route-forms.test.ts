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

describe('LLM alias route forms', () => {
  it('wires the Routes resource to the create and update form routes', () => {
    const route = llmAdminResources.find(resource => resource.key === 'routes');
    expect(route).toMatchObject({createForm:'createAliasRoute',updateForm:'updateAliasRoute'});
    expect(route?.formFields).toEqual([
      'hostId','aliasRouteId','publicAliasId','providerDeploymentId','routePriority',
      'routeWeight','fallbackEnabled','canaryPercent','residencyConditions','aggregateVersion',
    ]);
    expect(route?.formFields).not.toContain('active');
  });

  it.each([
    ['createAliasRoute','createLlmAliasRoute','/help/portal-view/forms/create-alias-route'],
    ['updateAliasRoute','updateLlmAliasRoute','/help/portal-view/forms/update-alias-route'],
  ] as const)('defines %s with the route command contract', (formId, action, helpPath) => {
    const definition = forms[formId];
    expect(definition.helpPath).toBe(helpPath);
    expect(definition.actions[0]).toMatchObject({
      service:'genai',action,success:'/app/genai/LlmModelControlPlane',
    });
    expect(definition.schema.additionalProperties).toBe(false);
    expect(definition.schema.properties).not.toHaveProperty('active');
    expect(definition.form).not.toContain('active');
    expect(definition.schema.properties.routePriority).toMatchObject({type:'integer',minimum:0});
    expect(definition.schema.properties.routeWeight).toMatchObject({
      type:'integer',enum:[1],readonly:true,
    });
    expect(definition.schema.properties.canaryPercent).toMatchObject({
      type:'number',enum:[0],readonly:true,
    });
    expect(definition.schema.properties.residencyConditions).toMatchObject({type:'object'});

    const items = definition.form as FormItem[];
    const alias = items.find(item => typeof item === 'object' && item.key === 'publicAliasId');
    const deployment = items.find(item => typeof item === 'object' && item.key === 'providerDeploymentId');
    const residency = items.find(item => typeof item === 'object' && item.key === 'residencyConditions');
    expect(alias).toMatchObject({type:'dynaselect',multiple:false,optionValueKey:'id'});
    expect(alias && typeof alias === 'object' ? alias.action?.url : '').toContain('getLlmPublicAliasLabel');
    expect(deployment).toMatchObject({type:'dynaselect',multiple:false,optionValueKey:'id'});
    expect(deployment && typeof deployment === 'object' ? deployment.action?.url : '')
      .toContain('getLlmProviderDeploymentLabel');
    expect(residency).toMatchObject({type:'structured',defaultTab:'json'});
  });

  it('requires route identity on create and optimistic concurrency on update', () => {
    expect(forms.createAliasRoute.schema.required).toEqual([
      'hostId','publicAliasId','providerDeploymentId','routePriority',
    ]);
    expect(forms.createAliasRoute.schema.properties).toMatchObject({
      routeWeight:{default:1},fallbackEnabled:{default:false},
      canaryPercent:{default:0},residencyConditions:{default:{}},
    });
    expect(forms.updateAliasRoute.schema.required).toEqual([
      'hostId','aliasRouteId','aggregateVersion',
    ]);
    expect(forms.updateAliasRoute.schema.properties.aliasRouteId.readonly).toBe(true);
    expect(forms.updateAliasRoute.schema.properties.aggregateVersion.readonly).toBe(true);
  });
});
