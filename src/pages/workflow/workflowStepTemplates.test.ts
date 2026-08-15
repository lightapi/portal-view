import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { DEFAULT_WORKFLOW_DEFINITION, appendWorkflowStepSnippet } from './workflowEditorModel';
import { normalizeWorkflowStepId, workflowStepTemplates } from './workflowStepTemplates';

const expectedTemplateIds = [
    'ask',
    'assert',
    'http',
    'openapi',
    'jsonrpc',
    'openrpc',
    'grpc',
    'mcp',
    'rule',
    'agent',
    'workflow',
    'fork',
    'switch',
    'condition',
    'set',
    'export',
    'wait',
];

describe('workflow step templates', () => {
    it('offers every task type recognized by the workflow editor', () => {
        expect(workflowStepTemplates.map(template => template.id)).toEqual(expectedTemplateIds);
    });

    it.each(workflowStepTemplates)('inserts the $id template into the do list', template => {
        const stepId = `test-${template.id}`;
        const updated = appendWorkflowStepSnippet(DEFAULT_WORKFLOW_DEFINITION, template.build(stepId));
        const parsed = YAML.parse(updated);

        expect(parsed.do).toHaveLength(1);
        expect(parsed.do[0]).toHaveProperty(stepId);
    });

    it('preserves an explicitly entered camelCase step id', () => {
        expect(normalizeWorkflowStepId('loadCustomerContext', 'parallel-work')).toBe('loadCustomerContext');
        expect(normalizeWorkflowStepId('  load customer context  ', 'parallel-work')).toBe('load-customer-context');
    });
});
