import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ listProcesses: vi.fn() }));

vi.mock('./workflowAdminClient', () => ({
    workflowAdminClient: { listProcesses: mocks.listProcesses },
}));
vi.mock('../../contexts/UserContext', () => ({
    useUserState: () => ({ host: '01964b05-552a-7c4b-9184-6857e7f3dc5f', userId: 'user-1' }),
}));
vi.mock('../../components/PortalActions/usePortalActionTableOptions', () => ({
    usePortalActionTableOptions: (options: unknown) => options,
}));
vi.mock('../../components/PortalActions/PortalActions', () => ({
    PortalActionScope: ({ children }: { children: ReactNode }) => <>{children}</>,
    PortalActions: () => null,
}));
vi.mock('./workflowTaskUtils', () => ({
    buildWorkflowTaskContext: () => ({}),
    WorkflowTaskLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import ProcessInfo from './ProcessInfo';

const definitionId = '019e4881-9637-731c-a443-6590d25c5204';
const instanceId = '01a0da0b-f7f5-7d01-b430-baacdb09c3b7';

describe('Process Info Editor link', () => {
    beforeEach(() => {
        mocks.listProcesses.mockReset();
        mocks.listProcesses.mockResolvedValue({ processes: [{
            processId: '01a0d9fb-f922-7f1b-8a16-abbf77a27730',
            workflowInstanceId: instanceId,
            definitionId,
            workflowName: 'simple-set-assert',
            workflowVersion: '1.0.4',
            processState: 'COMPLETED',
            invocationState: 'COMPLETED',
            createdAt: '2026-09-25T19:00:00Z',
            updatedAt: '2026-09-25T19:00:01Z',
            canCancelInvocation: { allowed: false },
        }], page: { hasMore: false } });
    });

    it('applies both URL filters and displays the definition ID and workflow name', async () => {
        render(<MemoryRouter initialEntries={[`/app/workflow/ProcessInfo?wfDefId=${definitionId}&wfInstanceId=${instanceId}`]}>
            <Routes><Route path="/app/workflow/ProcessInfo" element={<ProcessInfo />} /></Routes>
        </MemoryRouter>);

        await waitFor(() => expect(mocks.listProcesses).toHaveBeenCalledWith(expect.objectContaining({
            definitionId, workflowInstanceId: instanceId,
        })));
        expect(screen.getByRole('textbox', { name: 'Definition ID' })).toHaveValue(definitionId);
        expect(screen.getByRole('textbox', { name: 'Instance ID' })).toHaveValue(instanceId);
        expect(screen.queryByText('Enter a valid UUID')).not.toBeInTheDocument();
        expect(await screen.findByText('simple-set-assert')).toBeInTheDocument();
        expect(screen.getByText(definitionId)).toBeInTheDocument();
    });
});
