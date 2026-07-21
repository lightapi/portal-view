import {describe, expect, it} from 'vitest';
import forms from '../../../data/Forms.json';

describe('LLM model dynamic forms', () => {
  it('keeps JSONB values typed and uses llm_model taxonomy selectors', () => {
    for (const formId of ['createLlmModel', 'updateLlmModel'] as const) {
      const definition = forms[formId];
      expect(definition.actions[0].action).toBe(formId);
      expect(definition.schema.properties.modalities).toMatchObject({type: 'array', items: {type: 'string'}});
      expect(definition.schema.properties.operations).toMatchObject({type: 'array', items: {type: 'string'}});
      expect(definition.schema.properties.declaredCapabilities).toMatchObject({type: 'object'});

      const category = definition.form.find(item => typeof item === 'object' && item.key === 'categoryIds');
      const tag = definition.form.find(item => typeof item === 'object' && item.key === 'tagIds');
      expect(category).toMatchObject({type: 'dynaselect', multiple: true, optionValueKey: 'id'});
      expect(tag).toMatchObject({type: 'dynaselect', multiple: true, optionValueKey: 'id'});
      expect(category && typeof category === 'object' ? category.action.url : '').toContain('llm_model');
      expect(tag && typeof tag === 'object' ? tag.action.url : '').toContain('llm_model');
    }
  });
});
