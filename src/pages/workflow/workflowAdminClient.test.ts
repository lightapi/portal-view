import { describe, expect, it } from 'vitest';
import { parseWorkflowToolResult } from './workflowAdminClient';

describe('workflowAdminClient result parsing', () => {
    it('prefers structured content and accepts compact JSON text', () => {
        expect(parseWorkflowToolResult({ structuredContent: { ok: true } })).toEqual({ ok: true });
        expect(parseWorkflowToolResult({ content: [{ type: 'text', text: '{"ok":true}' }] })).toEqual({ ok: true });
    });

    it('surfaces tool errors and rejects missing results', () => {
        expect(() => parseWorkflowToolResult({ isError: true, content: [{ type: 'text', text: 'claim conflict' }] }))
            .toThrow('claim conflict');
        expect(() => parseWorkflowToolResult({ content: [] })).toThrow('no structured Workflow result');
    });
});
