import {describe, expect, it} from 'vitest';
import forms from '../../../data/Forms.json';

describe('LLM model dynamic forms', () => {
  it('uses dedicated create help while retaining control-plane help for update', () => {
    expect(forms.createLlmModel.helpPath).toBe('/help/portal-view/pages/create-llm-model');
    expect(forms.updateLlmModel.helpPath).toBe('/help/portal-view/pages/llm-model-control-plane');
  });

  it('keeps JSONB values typed and uses llm_model taxonomy selectors', () => {
    for (const formId of ['createLlmModel', 'updateLlmModel'] as const) {
      const definition = forms[formId];
      expect(definition.actions[0].action).toBe(formId);
      expect(definition.schema.properties.modalities).toMatchObject({type: 'array', items: {type: 'string'}});
      expect(definition.schema.properties.operations).toMatchObject({type: 'array', items: {type: 'string'}});
      expect(definition.schema.properties.declaredCapabilities).toMatchObject({type: 'object'});

      const modalities = definition.form.find(item => typeof item === 'object' && item.key === 'modalities');
      const operations = definition.form.find(item => typeof item === 'object' && item.key === 'operations');
      const declaredCapabilities = definition.form.find(
        item => typeof item === 'object' && item.key === 'declaredCapabilities',
      );
      expect(modalities).toMatchObject({
        type: 'structured', tabs: ['form', 'json', 'yaml'], defaultTab: 'form',
      });
      expect(operations).toMatchObject({
        type: 'structured', tabs: ['form', 'json', 'yaml'], defaultTab: 'form',
      });
      expect(declaredCapabilities).toMatchObject({
        type: 'structured', tabs: ['form', 'json', 'yaml'], defaultTab: 'json',
      });

      const category = definition.form.find(item => typeof item === 'object' && item.key === 'categoryIds');
      const tag = definition.form.find(item => typeof item === 'object' && item.key === 'tagIds');
      expect(category).toMatchObject({type: 'dynaselect', multiple: true, optionValueKey: 'id'});
      expect(tag).toMatchObject({type: 'dynaselect', multiple: true, optionValueKey: 'id'});
      expect(category && typeof category === 'object' ? category.action.url : '').toContain('llm_model');
      expect(tag && typeof tag === 'object' ? tag.action.url : '').toContain('llm_model');
    }
  });
});
