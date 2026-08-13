import {describe, expect, it} from 'vitest';
import forms from '../../data/Forms.json';

describe('GenAI tool forms', () => {
  it.each(['createTool', 'updateTool'] as const)(
    'edits %s workflow bindings as structured objects',
    formId => {
      const definition = forms[formId];
      expect(definition.schema.properties.workflowBinding).toMatchObject({type: 'object'});

      const workflowBinding = definition.form.find(
        item => typeof item === 'object' && item.key === 'workflowBinding',
      );
      expect(workflowBinding).toMatchObject({
        type: 'structured',
        tabs: ['form', 'json', 'yaml'],
        defaultTab: 'json',
        editorRows: 16,
        condition: "model.executionPlacement === 'workflow'",
      });
    },
  );
});
