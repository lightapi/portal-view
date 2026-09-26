import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getHumanTask: vi.fn(),
    completeHumanTask: vi.fn(),
    claimHumanTask: vi.fn(),
    releaseHumanTask: vi.fn(),
}));

vi.mock('../../contexts/UserContext', () => ({
    useUserState: () => ({ host: '00000000-0000-0000-0000-000000000001', userId: 'user-1' }),
}));
vi.mock('./workflowAdminClient', () => ({
    workflowAdminClient: {
        getHumanTask: mocks.getHumanTask,
        completeHumanTask: mocks.completeHumanTask,
        claimHumanTask: mocks.claimHumanTask,
        releaseHumanTask: mocks.releaseHumanTask,
    },
}));

import HumanTask from './HumanTask';

describe('HumanTask workflow Tool access decision', () => {
    beforeEach(() => {
        mocks.getHumanTask.mockReset();
        mocks.completeHumanTask.mockReset();
        mocks.claimHumanTask.mockReset();
        mocks.releaseHumanTask.mockReset();
        mocks.getHumanTask.mockResolvedValue({
            task: {
                hostId: '00000000-0000-0000-0000-000000000001',
                taskAsstId: '00000000-0000-0000-0000-000000000002',
                taskId: '00000000-0000-0000-0000-000000000003',
                assignmentVersion: 1,
                wfInstanceId: 'workflow-instance-1',
                wfTaskId: 'reviewToolAccess', assignmentStatus: 'CLAIMED', taskStatus: 'W',
                claimedBy: 'user-1', canComplete: { allowed: true }, canRelease: { allowed: true },
                context: {
                    requestId: '00000000-0000-0000-0000-000000000004', requestDigest: `sha256:${'a'.repeat(64)}`,
                    requesterUserId: 'author-1', targetWfDefId: '00000000-0000-0000-0000-000000000005',
                    justification: 'Read customer profile.', items: [{
                        toolId: '00000000-0000-0000-0000-000000000006', capabilityRef: 'API/getCustomer',
                        toolVersion: '1.0.0', lightapiDigest: `sha256:${'b'.repeat(64)}`,
                        allowedEnvironments: ['dev'], usageLocations: ['do[0].profile'],
                    }],
                },
            },
            ask: {
                action: 'workflow-tool-access-decision', mode: 'approval', commentRequired: true,
                prompt: 'Review Tool access', options: [{ label: 'Approve', value: 'APPROVE' }, { label: 'Reject', value: 'REJECT' }],
            },
        });
    });

    it('renders exact pins and blocks decisions until role freshness is qualified', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter initialEntries={['/app/workflow/HumanTask?taskAsstId=00000000-0000-0000-0000-000000000002']}>
            <Routes><Route path="/app/workflow/HumanTask" element={<HumanTask />} /></Routes>
        </MemoryRouter>);

        expect(await screen.findByText('API/getCustomer')).toBeInTheDocument();
        expect(screen.getByText('Read customer profile.')).toBeInTheDocument();
        await user.type(screen.getByLabelText('Comment'), 'Approved for the customer workflow.');
        await user.click(screen.getByRole('button', { name: 'Approve' }));

        expect(await screen.findByText(/remain unavailable until live ROLE membership freshness is qualified/)).toBeInTheDocument();
        expect(mocks.completeHumanTask).not.toHaveBeenCalled();
    });

    it('keeps an ordinary approval failure visible after refreshing the task', async () => {
        const user = userEvent.setup();
        mocks.getHumanTask.mockResolvedValue({
            task: {
                hostId: '00000000-0000-0000-0000-000000000001',
                taskAsstId: '00000000-0000-0000-0000-000000000002',
                taskId: '00000000-0000-0000-0000-000000000003',
                assignmentVersion: 4,
                wfTaskId: 'manualApproval', assignmentStatus: 'CLAIMED', taskStatus: 'W',
                claimedBy: 'user-1', canComplete: { allowed: true },
            },
            ask: {
                mode: 'approval', prompt: 'Review mortgage',
                options: [{ label: 'Approve', value: 'APPROVED' }],
            },
        });
        mocks.completeHumanTask.mockRejectedValue(new Error('Workflow task submission failed'));

        render(<MemoryRouter initialEntries={['/app/workflow/HumanTask?taskAsstId=00000000-0000-0000-0000-000000000002']}>
            <Routes><Route path="/app/workflow/HumanTask" element={<HumanTask />} /></Routes>
        </MemoryRouter>);

        await user.click(await screen.findByRole('button', { name: 'Approve' }));

        expect(await screen.findByText('Workflow task submission failed')).toBeInTheDocument();
        expect(mocks.getHumanTask).toHaveBeenCalledTimes(2);
    });

    it.each([
        ['Claim', 'ASSIGNED', 'claimHumanTask', 'Claim failed'],
        ['Release', 'CLAIMED', 'releaseHumanTask', 'Release failed'],
    ] as const)('keeps a failed %s error visible after refreshing the task', async (button, status, method, message) => {
        const user = userEvent.setup();
        mocks.getHumanTask.mockResolvedValue({
            task: {
                hostId: '00000000-0000-0000-0000-000000000001',
                taskAsstId: '00000000-0000-0000-0000-000000000002',
                taskId: '00000000-0000-0000-0000-000000000003',
                assignmentVersion: 4,
                wfTaskId: 'manualApproval', assignmentStatus: status, taskStatus: 'W',
                claimedBy: status === 'CLAIMED' ? 'user-1' : null,
                canClaim: { allowed: button === 'Claim' },
                canRelease: { allowed: button === 'Release' },
                canComplete: { allowed: false },
            },
            ask: { mode: 'approval', prompt: 'Review mortgage' },
        });
        mocks[method].mockRejectedValue(new Error(message));

        render(<MemoryRouter initialEntries={['/app/workflow/HumanTask?taskAsstId=00000000-0000-0000-0000-000000000002']}>
            <Routes><Route path="/app/workflow/HumanTask" element={<HumanTask />} /></Routes>
        </MemoryRouter>);

        await user.click(await screen.findByRole('button', { name: button }));

        expect(await screen.findByText(message)).toBeInTheDocument();
        expect(mocks.getHumanTask).toHaveBeenCalledTimes(2);
    });
});
