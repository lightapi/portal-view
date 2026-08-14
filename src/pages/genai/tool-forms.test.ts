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

      const responseSchema = definition.form.find(
        item => typeof item === 'object' && item.key === 'responseSchema',
      );
      expect(responseSchema).toMatchObject({
        type: 'textarea',
        condition: "model.implementationType === 'lightapi_endpoint' || model.executionPlacement === 'workflow'",
      });
    },
  );

  it('selects the owning Tool when creating a Tool Parameter', () => {
    const toolId = forms.createToolParam.form.find(
      item => typeof item === 'object' && item.key === 'toolId',
    );

    expect(toolId).toMatchObject({
      type: 'dynaselect',
      multiple: false,
      action: {
        params: ['hostId'],
      },
    });
    expect(toolId && typeof toolId === 'object' && 'action' in toolId
      ? toolId.action.url
      : '').toContain('getToolLabel');
  });
});
