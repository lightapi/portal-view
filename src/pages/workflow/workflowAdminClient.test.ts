import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findTool: vi.fn(), invoke: vi.fn() }));
vi.mock('../genai/workflowToolClient', () => ({
    createWorkflowToolClient: () => mocks,
}));

import { workflowAdminClient } from './workflowAdminClient';

beforeEach(() => {
    mocks.findTool.mockReset().mockResolvedValue({ name: 'workflow_start' });
    mocks.invoke.mockReset().mockResolvedValue({ structuredContent: { accepted: true }, isError: false });
});

describe('Workflow start client', () => {
    it('sends the exact start arguments through Gateway MCP', async () => {
        const args = {
            workflowDefinitionId: 'definition', input: { value: 1 }, idempotencyKey: 'attempt',
        };
        await expect(workflowAdminClient.start(args)).resolves.toEqual({ accepted: true });
        expect(mocks.findTool).toHaveBeenCalledWith('workflow_start');
        expect(mocks.invoke).toHaveBeenCalledWith('workflow_start', args, '');
    });
    it('does not treat an MCP tool error as acceptance', async () => {
        mocks.invoke.mockResolvedValue({ isError: true, content: [{ type: 'text', text: 'Denied' }] });
        await expect(workflowAdminClient.start({ workflowDefinitionId: '', input: {}, idempotencyKey: '' })).rejects.toThrow('Denied');
    });
});
