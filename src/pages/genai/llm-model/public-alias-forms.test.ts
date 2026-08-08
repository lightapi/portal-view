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

describe('LLM public alias forms', () => {
  it('wires the Aliases resource to the create and update form routes', () => {
    const alias = llmAdminResources.find(resource => resource.key === 'aliases');
    expect(alias).toMatchObject({createForm:'createPublicAlias',updateForm:'updatePublicAlias'});
    expect(alias?.formFields).toEqual([
      'hostId','publicAliasId','environment','aliasName','operations','requiredCapabilities',
      'requireExpectedEmbeddingSpace','embeddingWorkloadLane',
      'maxInputTokens','maxOutputTokens','maxRequestBytes','dataClassification','loggingMode',
      'piiMode','lifecycleStatus','replacementAliasId','aliasVisibility','boundAgentDefId',
      'boundWorkloadPrincipal','aggregateVersion',
    ]);
    expect(alias?.formFields).not.toContain('active');
  });

  it.each([
    ['createPublicAlias','createLlmPublicAlias','/help/portal-view/forms/create-public-alias'],
    ['updatePublicAlias','updateLlmPublicAlias','/help/portal-view/forms/update-public-alias'],
  ] as const)('defines %s with the alias command contract', (formId, action, helpPath) => {
    const definition = forms[formId];
    expect(definition.helpPath).toBe(helpPath);
    expect(definition.actions[0]).toMatchObject({
      service:'genai',action,success:'/app/genai/LlmModelControlPlane',
    });
    expect(definition.schema.additionalProperties).toBe(false);
    expect(definition.schema.properties).not.toHaveProperty('active');
    expect(definition.form).not.toContain('active');
    expect(definition.schema.properties.operations).toMatchObject({type:'array',items:{type:'string'}});
    expect(definition.schema.properties.requiredCapabilities).toMatchObject({type:'object'});
    expect(definition.schema.properties.requireExpectedEmbeddingSpace).toMatchObject({type:'boolean'});
    expect(definition.schema.properties.embeddingWorkloadLane.enum)
      .toEqual(['standard','kb_query','kb_index']);
    expect(definition.schema.properties.loggingMode.enum).toEqual(['NONE','METADATA','REDACTED']);
    expect(definition.schema.properties.piiMode.enum).toEqual(['DENY','REDACT','TOKENIZE','ALLOW']);
    expect(definition.schema.properties.aliasVisibility.enum)
      .toEqual(['PUBLIC','INTERNAL_LEGACY','INTERNAL_WORKLOAD']);
    expect(definition.schema.properties.replacementAliasId.type).toEqual(['string','null']);
    expect(definition.schema.properties.dataClassification.type).toEqual(['string','null']);

    const items = definition.form as FormItem[];
    expect(items.find(item => typeof item === 'object' && item.key === 'operations'))
      .toMatchObject({type:'structured',defaultTab:'json'});
    expect(items.find(item => typeof item === 'object' && item.key === 'requiredCapabilities'))
      .toMatchObject({type:'structured',defaultTab:'json'});
    const replacement = items.find(item => typeof item === 'object' && item.key === 'replacementAliasId');
    const agent = items.find(item => typeof item === 'object' && item.key === 'boundAgentDefId');
    expect(replacement).toMatchObject({type:'dynaselect',multiple:false,optionValueKey:'id'});
    expect(replacement && typeof replacement === 'object' ? replacement.action?.url : '')
      .toContain('getLlmPublicAliasLabel');
    expect(agent).toMatchObject({type:'dynaselect',multiple:false,optionValueKey:'id'});
    expect(agent && typeof agent === 'object' ? agent.action?.url : '')
      .toContain('getAgentDefinitionLabel');
  });

  it('requires alias identity on create and optimistic concurrency on update', () => {
    expect(forms.createPublicAlias.schema.required).toEqual(['hostId','environment','aliasName']);
    expect(forms.createPublicAlias.schema.properties).toMatchObject({
      loggingMode:{default:'METADATA'},piiMode:{default:'DENY'},
      lifecycleStatus:{default:'DRAFT'},aliasVisibility:{default:'PUBLIC'},
    });
    expect(forms.updatePublicAlias.schema.required).toEqual(['hostId','publicAliasId','aggregateVersion']);
    expect(forms.updatePublicAlias.schema.properties.publicAliasId.readonly).toBe(true);
    expect(forms.updatePublicAlias.schema.properties.aggregateVersion.readonly).toBe(true);
    expect(forms.updatePublicAlias.submitOmitFields).toEqual([
      'operations','requiredCapabilities.embeddingSpace','requireExpectedEmbeddingSpace','embeddingWorkloadLane',
    ]);
  });
});
