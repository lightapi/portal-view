import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import {
    addWorkflowForkBranch,
    appendWorkflowStepSnippet,
    collectWorkflowStepLabels,
    DEFAULT_WORKFLOW_DEFINITION,
    extractWorkflowEvaluationLanguage,
    extractWorkflowDefinitionMetadata,
    extractWorkflowInlineSchema,
    getWorkflowForkBranches,
    insertWorkflowStepSnippet,
    removeWorkflowForkBranch,
    renameWorkflowForkBranch,
    setWorkflowForkBranchTask,
    updateWorkflowEvaluationLanguage,
    updateWorkflowDocumentMetadata,
    updateWorkflowInlineSchema,
    workflowStepIdAtOffset,
    workflowStepLocations,
    WORKFLOW_SCHEMA_FORMATS,
} from './workflowEditorModel';

function record(value: unknown): Record<string, unknown> {
    return value as Record<string, unknown>;
}

describe('workflow editor authoring model', () => {
    const forkDefinition = `document:
  dsl: "1.0.3"
  namespace: light-demo
  name: branch-editor
  version: "1.0.0"
do:
  - loadCustomerContext:
      fork:
        branches:
          - branchOne:
              set:
                value: first
          - branchTwo:
              set:
                value: second
        compete: false
`;

    it('offers only the inline schema format enforced by the workflow runtime', () => {
        expect(WORKFLOW_SCHEMA_FORMATS).toEqual(['json']);
    });

    it('starts new workflows with DSL document metadata and a do container', () => {
        const parsed = record(YAML.parse(DEFAULT_WORKFLOW_DEFINITION));

        expect(parsed).not.toHaveProperty('steps');
        expect(parsed.do).toEqual([]);
        expect(parsed.evaluate).toEqual({ language: 'cel' });
        expect(parsed.document).toMatchObject({
            dsl: '1.0.3',
            namespace: 'default',
            name: 'new-workflow',
            version: '1.0.0',
        });
    });

    it('keeps form metadata synchronized into document metadata', () => {
        const updated = updateWorkflowDocumentMetadata(DEFAULT_WORKFLOW_DEFINITION, {
            namespace: 'light-demo',
            name: 'order-workflow',
            version: '2.0.0',
            title: 'Customer workflow',
            summary: 'Build this workflow through generic editor controls.',
        });
        const parsed = record(YAML.parse(updated));

        expect(extractWorkflowDefinitionMetadata(updated)).toEqual({
            dsl: '1.0.3',
            namespace: 'light-demo',
            name: 'order-workflow',
            version: '2.0.0',
            title: 'Customer workflow',
            summary: 'Build this workflow through generic editor controls.',
        });
        expect(parsed).not.toHaveProperty('version');
        expect(parsed.document).toMatchObject({ dsl: '1.0.3', version: '2.0.0' });
    });

    it('round-trips the supported expression language through evaluate', () => {
        const updated = updateWorkflowEvaluationLanguage(DEFAULT_WORKFLOW_DEFINITION, 'jq');

        expect(extractWorkflowEvaluationLanguage(updated)).toBe('jq');
        expect(record(YAML.parse(updated)).evaluate).toEqual({ language: 'jq' });
    });

    it('adds, updates, and removes inline input and output schemas', () => {
        const inputDocument = {
            type: 'object',
            additionalProperties: false,
            required: ['customerId'],
            properties: { customerId: { type: 'string', minLength: 1 } },
        };
        const outputDocument = {
            type: 'object',
            required: ['results'],
            properties: { results: { type: 'array', items: { type: 'object' } } },
        };
        const withInput = updateWorkflowInlineSchema(DEFAULT_WORKFLOW_DEFINITION, 'input', {
            enabled: true,
            format: 'json',
            document: inputDocument,
        });
        const withBoth = updateWorkflowInlineSchema(withInput, 'output', {
            enabled: true,
            format: 'json',
            document: outputDocument,
        });

        expect(extractWorkflowInlineSchema(withBoth, 'input')).toEqual({
            enabled: true,
            format: 'json',
            document: inputDocument,
        });
        expect(extractWorkflowInlineSchema(withBoth, 'output')).toEqual({
            enabled: true,
            format: 'json',
            document: outputDocument,
        });

        const withoutInput = updateWorkflowInlineSchema(withBoth, 'input', {
            enabled: false,
            format: 'json',
            document: inputDocument,
        });
        expect(record(YAML.parse(withoutInput))).not.toHaveProperty('input');
        expect(record(YAML.parse(withoutInput))).toHaveProperty('output');
    });

    it('inserts palette steps into do without creating a competing steps container', () => {
        const updated = appendWorkflowStepSnippet(
            DEFAULT_WORKFLOW_DEFINITION,
            '  - wait-for-event:\n      wait:\n        duration: PT5M\n',
        );
        const parsed = record(YAML.parse(updated));

        expect(parsed).not.toHaveProperty('steps');
        expect(parsed.do).toEqual([{ 'wait-for-event': { wait: { duration: 'PT5M' } } }]);
        expect(collectWorkflowStepLabels(parsed)).toEqual(['wait-for-event']);
    });

    it('preserves legacy steps workflows when inserting a palette step', () => {
        const updated = appendWorkflowStepSnippet(
            'steps:\n  - first:\n      ask:\n        prompt: Ready?\n',
            '  - second:\n      wait:\n        duration: PT5M\n',
        );
        const parsed = record(YAML.parse(updated));

        expect(parsed.steps).toHaveLength(2);
        expect(parsed).not.toHaveProperty('do');
    });

    it('finds the top-level workflow step containing the YAML cursor', () => {
        const definition = `document:\n  name: cursor-selection\ndo:\n  - first:\n      set:\n        value: 1\n  - second:\n      wait:\n        duration: PT5M\n  - third:\n      set:\n        value: 3\n`;
        const locations = workflowStepLocations(definition);

        expect(workflowStepIdAtOffset(locations, definition.indexOf('first:'))).toBe('first');
        expect(workflowStepIdAtOffset(locations, definition.indexOf('value: 1'))).toBe('first');
        expect(workflowStepIdAtOffset(locations, definition.indexOf('  - second:'))).toBe('second');
        expect(workflowStepIdAtOffset(locations, definition.indexOf('duration:'))).toBe('second');
        expect(workflowStepIdAtOffset(locations, definition.indexOf('  - third:'))).toBe('third');
        expect(workflowStepIdAtOffset(locations, definition.indexOf('document:'))).toBe('');
        expect(workflowStepLocations('do: [')).toEqual([]);
    });

    it('uses name and id values consistently for cursor selection and insertion', () => {
        const definition = `do:\n  - name: alpha\n    set:\n      value: 1\n  - name: beta\n    wait:\n      duration: PT5M\n  - id: gamma\n    set:\n      value: 3\n`;
        const locations = workflowStepLocations(definition);

        expect(workflowStepIdAtOffset(locations, definition.indexOf('name: beta'))).toBe('beta');
        expect(workflowStepIdAtOffset(locations, definition.indexOf('id: gamma'))).toBe('gamma');
        const updated = insertWorkflowStepSnippet(
            definition,
            '  - inserted:\n      set:\n        value: 2\n',
            'beta',
            'after',
        );
        expect(collectWorkflowStepLabels(YAML.parse(updated))).toEqual(['alpha', 'beta', 'inserted', 'gamma']);
    });

    it('uses graph-compatible synthetic ids for anonymous task-shaped items', () => {
        const definition = `do:\n  - wait:\n      duration: PT5M\n  - set:\n      value: ready\n`;
        const locations = workflowStepLocations(definition);

        expect(locations.map(location => location.stepId)).toEqual(['do-1', 'do-2']);
        const updated = insertWorkflowStepSnippet(
            definition,
            '  - named:\n      set:\n        value: inserted\n',
            'do-1',
            'after',
        );
        expect(collectWorkflowStepLabels(YAML.parse(updated))).toEqual(['do-1', 'named', 'do-3']);
    });

    it('uses the same priority container for locations, labels, and insertion', () => {
        const definition = `states:\n  oldState:\n    type: operation\ndo:\n  - first:\n      set:\n        value: 1\n`;
        const locations = workflowStepLocations(definition);

        expect(locations.map(location => location.stepId)).toEqual(['first']);
        expect(collectWorkflowStepLabels(YAML.parse(definition))).toEqual(['first']);
        const updated = insertWorkflowStepSnippet(
            definition,
            '  - second:\n      wait:\n        duration: PT5M\n',
            'first',
            'after',
        );
        expect(collectWorkflowStepLabels(YAML.parse(updated))).toEqual(['first', 'second']);
    });

    it('supports cursor selection and relative insertion in map-shaped containers', () => {
        const definition = `states:\n  first:\n    type: operation\n  third:\n    type: operation\n`;
        const locations = workflowStepLocations(definition);

        expect(workflowStepIdAtOffset(locations, definition.indexOf('  third:'))).toBe('third');
        const updated = insertWorkflowStepSnippet(
            definition,
            '  - second:\n      set:\n        value: 2\n',
            'third',
            'before',
        );
        expect(Object.keys(record(YAML.parse(updated)).states as Record<string, unknown>))
            .toEqual(['first', 'second', 'third']);
    });

    it('inserts palette steps before or after the selected top-level step', () => {
        const definition = `document:\n  name: relative-insertion\ndo:\n  - first:\n      set:\n        value: 1\n  - third:\n      wait:\n        duration: PT5M\n`;
        const snippet = '  - second:\n      set:\n        value: 2\n';

        const beforeThird = insertWorkflowStepSnippet(definition, snippet, 'third', 'before');
        const afterFirst = insertWorkflowStepSnippet(definition, snippet, 'first', 'after');

        expect((record(YAML.parse(beforeThird)).do as Array<Record<string, unknown>>)
            .map(step => Object.keys(step)[0])).toEqual(['first', 'second', 'third']);
        expect((record(YAML.parse(afterFirst)).do as Array<Record<string, unknown>>)
            .map(step => Object.keys(step)[0])).toEqual(['first', 'second', 'third']);
    });

    it('rejects insertion when the selected step no longer exists', () => {
        const definition = `do:\n  - first:\n      set:\n        value: 1\n`;
        expect(() => insertWorkflowStepSnippet(
            definition,
            '  - second:\n      wait:\n        duration: PT5M\n',
            'missing-step',
            'before',
        )).toThrow('is no longer available');
    });

    it('lists and renames fork branches without changing their task bodies', () => {
        expect(getWorkflowForkBranches(forkDefinition, 'loadCustomerContext')).toEqual([
            { name: 'branchOne' },
            { name: 'branchTwo' },
        ]);

        const updated = renameWorkflowForkBranch(
            forkDefinition,
            'loadCustomerContext',
            'branchOne',
            'profile',
        );
        const parsed = record(YAML.parse(updated));
        const tasks = parsed.do as Array<Record<string, unknown>>;
        const step = record(tasks[0].loadCustomerContext);
        const branches = record(step.fork).branches as Array<Record<string, unknown>>;

        expect(branches[0]).toEqual({ profile: { set: { value: 'first' } } });
        expect(getWorkflowForkBranches(updated, 'loadCustomerContext')).toEqual([
            { name: 'profile' },
            { name: 'branchTwo' },
        ]);
    });

    it('adds and removes fork branches while retaining at least two', () => {
        const withPolicies = addWorkflowForkBranch(forkDefinition, 'loadCustomerContext', 'policies');
        expect(getWorkflowForkBranches(withPolicies, 'loadCustomerContext')).toEqual([
            { name: 'branchOne' },
            { name: 'branchTwo' },
            { name: 'policies' },
        ]);

        const removed = removeWorkflowForkBranch(withPolicies, 'loadCustomerContext', 'branchTwo');
        expect(getWorkflowForkBranches(removed, 'loadCustomerContext')).toEqual([
            { name: 'branchOne' },
            { name: 'policies' },
        ]);
        expect(() => removeWorkflowForkBranch(removed, 'loadCustomerContext', 'policies'))
            .toThrow('at least two branches');
    });

    it('rejects duplicate and invalid fork branch names', () => {
        expect(() => renameWorkflowForkBranch(
            forkDefinition,
            'loadCustomerContext',
            'branchOne',
            'branchTwo',
        )).toThrow('already exists');
        expect(() => addWorkflowForkBranch(forkDefinition, 'loadCustomerContext', 'customer profile'))
            .toThrow('only letters');
    });

    it('replaces one fork placeholder without changing siblings or fork metadata', () => {
        const updated = setWorkflowForkBranchTask(
            forkDefinition,
            'loadCustomerContext',
            'branchOne',
            '  - get-profile:\n      call: http\n      with:\n        method: GET\n        endpoint:\n          uri: lightapi://customer-api/profile.get\n',
        );
        const parsed = record(YAML.parse(updated));
        const fork = record(record((parsed.do as Array<Record<string, unknown>>)[0].loadCustomerContext).fork);
        const branches = fork.branches as Array<Record<string, unknown>>;

        expect(branches[0]).toEqual({
            branchOne: {
                call: 'http',
                with: { method: 'GET', endpoint: { uri: 'lightapi://customer-api/profile.get' } },
            },
        });
        expect(branches[1]).toEqual({ branchTwo: { set: { value: 'second' } } });
        expect(fork.compete).toBe(false);
    });
});
