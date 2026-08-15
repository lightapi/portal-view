import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { attachAiAuthoringApproval, buildDefinitionDiff } from './workflowAiAuthoring';

describe('workflow AI authoring review', () => {
    it('records reviewer approval and immutable generator provenance in document metadata', () => {
        const approved = attachAiAuthoringApproval(`document:
  dsl: 1.0.3
  namespace: demo
  name: customer-profile
  version: 1.0.0
evaluate:
  language: cel
do: []
`, {
            generatorModel: 'authoring-model',
            promptTemplateVersion: 'workflow-mcp-authoring-v2',
            workflowSchemaId: 'https://agentic-workflow.org/schemas/1.0.3/workflow.yaml',
            workflowSchemaVersion: '1.0.3',
            workflowSchemaDigest: 'd'.repeat(64),
            workflowSchemaSourceCommit: 'e'.repeat(40),
            sourceSchemaDigests: { getCustomerProfile: `sha256:${'a'.repeat(64)}` },
            requestDigest: `sha256:${'b'.repeat(64)}`,
            generatedDefinitionDigest: `sha256:${'c'.repeat(64)}`,
            generatedAt: '2026-08-12T20:00:00Z',
        }, 'reviewer-1');

        const parsed = YAML.parse(approved);
        expect(parsed.document.metadata.aiAuthoring.generatorModel).toBe('authoring-model');
        expect(parsed.document.metadata.aiAuthoring.workflowSchemaVersion).toBe('1.0.3');
        expect(parsed.document.metadata.aiAuthoring.reviewerApproval).toMatchObject({
            approved: true,
            reviewerUserId: 'reviewer-1',
            reviewMethod: 'portal-diff',
        });
    });

    it('renders a bounded human-readable replacement diff', () => {
        const diff = buildDefinitionDiff('one\ntwo\nthree', 'one\nchanged\nthree');
        expect(diff).toMatchObject({ removed: 1, added: 1 });
        expect(diff.text).toContain('- two');
        expect(diff.text).toContain('+ changed');
    });
});
