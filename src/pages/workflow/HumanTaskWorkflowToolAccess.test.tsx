import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchClient: vi.fn() }));

vi.mock('../../contexts/UserContext', () => ({
    useUserState: () => ({ host: '00000000-0000-0000-0000-000000000001', userId: 'user-1' }),
}));
vi.mock('../../utils/fetchClient', () => ({ default: mocks.fetchClient }));

import HumanTask from './HumanTask';

describe('HumanTask workflow Tool access decision', () => {
    beforeEach(() => {
        mocks.fetchClient.mockReset();
        mocks.fetchClient.mockImplementation((url: string, init?: { body?: unknown }) => {
            if (url.startsWith('/portal/query')) return Promise.resolve({
                hostId: '00000000-0000-0000-0000-000000000001',
                taskAsstId: '00000000-0000-0000-0000-000000000002',
                taskId: '00000000-0000-0000-0000-000000000003',
                wfInstanceId: 'workflow-instance-1',
                wfTaskId: 'reviewToolAccess', assignmentStatusCode: 'CLAIMED', taskStatusCode: 'W',
                claimedBy: 'user-1', canComplete: true, canRelease: true,
                ask: { action: 'workflow-tool-access-decision', mode: 'approval', commentRequired: true,
                    prompt: 'Review Tool access', options: [{ label: 'Approve', value: 'APPROVE' }, { label: 'Reject', value: 'REJECT' }] },
                context: { requestId: '00000000-0000-0000-0000-000000000004', requestDigest: `sha256:${'a'.repeat(64)}`,
                    requesterUserId: 'author-1', targetWfDefId: '00000000-0000-0000-0000-000000000005',
                    justification: 'Read customer profile.', items: [{
                        toolId: '00000000-0000-0000-0000-000000000006', capabilityRef: 'API/getCustomer',
                        toolVersion: '1.0.0', lightapiDigest: `sha256:${'b'.repeat(64)}`,
                        allowedEnvironments: ['dev'], usageLocations: ['do[0].profile'],
                    }] },
                workflow: { namespace: 'light-portal', name: 'grant-tools-to-workflow', version: '1.0.0' },
            });
            if (url === '/portal/command') return Promise.resolve({ data: init?.body });
            return Promise.resolve({});
        });
    });

    it('renders exact pins and dispatches the specialized atomic decision command', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter initialEntries={['/app/workflow/HumanTask?taskAsstId=00000000-0000-0000-0000-000000000002']}>
            <Routes><Route path="/app/workflow/HumanTask" element={<HumanTask />} /></Routes>
        </MemoryRouter>);

        expect(await screen.findByText('API/getCustomer')).toBeInTheDocument();
        expect(screen.getByText('Read customer profile.')).toBeInTheDocument();
        await user.type(screen.getByLabelText('Comment'), 'Approved for the customer workflow.');
        await user.click(screen.getByRole('button', { name: 'Approve' }));

        await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledWith('/portal/command', expect.objectContaining({
            method: 'POST', body: expect.objectContaining({
                action: 'decideWorkflowToolAccess', data: expect.objectContaining({
                    requestId: '00000000-0000-0000-0000-000000000004', decision: 'APPROVE',
                    taskAsstId: '00000000-0000-0000-0000-000000000002',
                }),
            }),
        })));
    });
});
