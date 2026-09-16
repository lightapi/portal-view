import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkflowToolInvokeDialog from './WorkflowToolInvokeDialog';

const mocks = vi.hoisted(() => ({ findTool: vi.fn(), invoke: vi.fn() }));
vi.mock('./workflowToolClient', async importOriginal => ({
    ...await importOriginal<typeof import('./workflowToolClient')>(),
    createWorkflowToolClient: () => mocks,
}));
const tool = { name: 'intake', toolId: 'tool', hostId: 'host' };
beforeEach(() => {
    mocks.findTool.mockReset().mockResolvedValue({ name: 'intake', inputSchema: { type: 'object' } });
    mocks.invoke.mockReset().mockResolvedValue({ structuredContent: { workflowInstanceId: 'run' } });
});
describe('Workflow invocation dialog', () => {
    it('loads the live catalog without invoking and requires explicit confirmation', async () => {
        render(<WorkflowToolInvokeDialog open tool={tool} onClose={vi.fn()} />);
        await screen.findByLabelText('Arguments (JSON object)');
        expect(mocks.invoke).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Authorize Workflow' })).not.toBeInTheDocument();
        expect(screen.queryByText(/begin issuer consent/i)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Invoke Workflow' })).toBeDisabled();
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.change(screen.getByLabelText('Arguments (JSON object)'), { target: { value: '{"x":1}' } });
        expect(screen.getByRole('checkbox')).not.toBeChecked();
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: 'Invoke Workflow' }));
        await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('intake', { x: 1 }, ''));
        expect((await screen.findByLabelText('Gateway result') as HTMLTextAreaElement).value).toContain('run');
        expect(screen.getByRole('button', { name: 'Invoke Workflow' })).toBeDisabled();
    });
    it('keeps an uncertain submission fenced instead of enabling another call', async () => {
        mocks.invoke.mockRejectedValueOnce(new Error('connection lost'));
        render(<WorkflowToolInvokeDialog open tool={tool} onClose={vi.fn()} />);
        await screen.findByLabelText('Arguments (JSON object)');
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: 'Invoke Workflow' }));
        await screen.findByText('connection lost');
        expect(screen.getByRole('button', { name: 'Invoke Workflow' })).toBeDisabled();
        expect(screen.getByLabelText('Arguments (JSON object)')).toBeDisabled();
        expect(mocks.invoke).toHaveBeenCalledTimes(1);
    });
    it('fails closed if the Gateway hides the Tool', async () => {
        mocks.findTool.mockRejectedValueOnce(new Error('Tool unavailable'));
        render(<WorkflowToolInvokeDialog open tool={tool} onClose={vi.fn()} />);
        await screen.findByText('Tool unavailable');
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        expect(mocks.invoke).not.toHaveBeenCalled();
    });
});
