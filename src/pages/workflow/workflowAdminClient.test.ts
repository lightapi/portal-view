import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findTool: vi.fn(), invoke: vi.fn() }));
vi.mock('../genai/workflowToolClient', () => ({
    createWorkflowToolClient: () => mocks,
}));

import { workflowAdminClient } from './workflowAdminClient';

beforeEach(() => {
    mocks.findTool.mockReset().mockResolvedValue({ name: 'workflow_binding_get' });
    mocks.invoke.mockReset().mockResolvedValue({ structuredContent: { revision: {bindingId: 'revision'} }, isError: false });
});

describe('Workflow binding read client', () => {
    it('reads the selected immutable revision through Gateway MCP', async () => {
        await expect(workflowAdminClient.getBinding('host', 'revision')).resolves.toEqual({revision: {bindingId: 'revision'}});
        expect(mocks.findTool).toHaveBeenCalledWith('workflow_binding_get');
        expect(mocks.invoke).toHaveBeenCalledWith('workflow_binding_get', {hostId: 'host', bindingId: 'revision'}, '');
    });
    it('does not treat an MCP error as a binding view', async () => {
        mocks.invoke.mockResolvedValue({ isError: true, content: [{ type: 'text', text: 'Denied' }] });
        await expect(workflowAdminClient.getBinding('host', 'revision')).rejects.toThrow('Denied');
    });
    it('passes the server cursor unchanged', async () => {
        await workflowAdminClient.listBindings({hostId: 'host', role: 'owner', status: 'pendingApproval', cursor: 'time|revision'});
        expect(mocks.invoke).toHaveBeenCalledWith('workflow_binding_list',
            {hostId: 'host', role: 'owner', status: 'pendingApproval', cursor: 'time|revision', limit: 100}, '');
    });
});
