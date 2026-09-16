import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import WorkflowRunControls from './WorkflowRunControls';
import { validWorkflowInstanceId } from './workflowRunId';
const mocks = vi.hoisted(() => ({ findTool: vi.fn(), invoke: vi.fn() }));
vi.mock('./workflowToolClient', () => ({ createWorkflowToolClient: () => mocks }));
const id = '01a0a18a-b142-7b38-8885-f8bdae25092b';
beforeEach(() => { mocks.findTool.mockReset().mockResolvedValue({}); mocks.invoke.mockReset().mockResolvedValue({ state: 'RUNNING' }); });
function open() {
    render(<WorkflowRunControls />);
    fireEvent.click(screen.getByRole('button', { name: 'Manage existing workflow run' }));
    fireEvent.change(screen.getByLabelText('Workflow instance ID'), { target: { value: id } });
}
it('validates exact non-nil IDs and performs no automatic reads or mutations', () => {
    expect(validWorkflowInstanceId(id)).toBe(true);
    for (const bad of ['', '../result', '00000000-0000-0000-0000-000000000000', `${id}?x=1`]) expect(validWorkflowInstanceId(bad)).toBe(false);
    open(); expect(mocks.invoke).not.toHaveBeenCalled(); expect(mocks.findTool).not.toHaveBeenCalled();
});
it('uses only the discovered lifecycle tool and the exact instance ID', async () => {
    open(); fireEvent.click(screen.getByRole('button', { name: 'Read run status' }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('workflow_get_status', { workflowInstanceId: id }, ''));
    expect(mocks.findTool).toHaveBeenCalledWith('workflow_get_status');
});
it('fails closed when lifecycle discovery is denied', async () => {
    mocks.findTool.mockRejectedValueOnce(new Error('not authorized'));
    open(); fireEvent.click(screen.getByRole('button', { name: 'Read run status' }));
    await screen.findByText('not authorized'); expect(mocks.invoke).not.toHaveBeenCalled();
});
it('requires cancellation confirmation and fences an uncertain attempt while permitting status reads', async () => {
    mocks.invoke.mockRejectedValueOnce(new Error('connection lost'));
    open(); expect(screen.getByRole('button', { name: 'Request run cancellation' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Request run cancellation' }));
    await screen.findByText('connection lost');
    expect(mocks.invoke).toHaveBeenCalledWith('workflow_cancel', { workflowInstanceId: id }, '');
    expect(screen.getByRole('button', { name: 'Request run cancellation' })).toBeDisabled();
    expect(screen.getByLabelText('Workflow instance ID')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Read run status' })).toBeEnabled();
});
