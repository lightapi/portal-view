import {describe, expect, it} from 'vitest';
import forms from '../../data/Forms.json';

describe('GenAI tool forms', () => {
  it.each(['createTool', 'updateTool'] as const)(
    'selects a published workflow version in %s without exposing internal binding fields',
    formId => {
      const definition = forms[formId];
      expect(definition.schema.properties.workflowBinding).toMatchObject({type: 'object'});
      expect(definition.schema.properties.workflowVersionRef).toMatchObject({type: 'string'});
      expect(definition).not.toHaveProperty('submitOmitFields');

      const workflowDefinition = definition.form.find(
        item => typeof item === 'object' && item.key === 'workflowVersionRef',
      );
      expect(workflowDefinition).toMatchObject({
        type: 'dynaselect',
        multiple: false,
        condition: "model.executionPlacement === 'workflow'",
      });

      const visibleKeys = definition.form.flatMap(item =>
        typeof item === 'object' && 'key' in item ? [item.key] : [],
      );
      expect(visibleKeys).not.toContain('workflowBinding');
      expect(visibleKeys).not.toContain('schemaDigest');
      expect(visibleKeys).not.toContain('workflowPolicyDigest');
      expect(visibleKeys).not.toContain('workflowResponsePolicyDigest');
    },
  );
});
