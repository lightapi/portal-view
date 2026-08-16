import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkflowToolAccessDialog from './WorkflowToolAccessDialog';

const mocks = vi.hoisted(() => ({
    apiPost: vi.fn(),
    fetchClient: vi.fn(),
    grants: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../api/apiPost', () => ({ apiPost: mocks.apiPost }));
vi.mock('../../utils/fetchClient', () => ({ default: mocks.fetchClient }));

function queryAction(url: string) {
    const parsed = new URL(url, 'https://portal.test');
    return JSON.parse(parsed.searchParams.get('cmd') || '{}').action;
}

function queryData(url: string) {
    const parsed = new URL(url, 'https://portal.test');
    return JSON.parse(parsed.searchParams.get('cmd') || '{}').data;
}

describe('WorkflowToolAccessDialog', () => {
    afterEach(() => vi.unstubAllGlobals());

    beforeEach(() => {
        mocks.apiPost.mockReset();
        mocks.apiPost.mockResolvedValue({ data: {} });
        mocks.grants = [];
        mocks.fetchClient.mockReset();
        mocks.fetchClient.mockImplementation((url: string) => {
            if (url === '/r/data?name=environment&host=host-a') {
                return Promise.resolve([
                    { id: 'dev', label: 'Development' },
                    { id: 'test', label: 'Testing' },
                ]);
            }
            if (queryAction(url) === 'getWfDefinition') {
                return Promise.resolve({ wfDefinitions: [
                    { wfDefId: 'workflow-a', namespace: 'sales', name: 'Order flow' },
                    { wfDefId: 'workflow-b', namespace: 'support', name: 'Return flow' },
                ] });
            }
            return Promise.resolve({ grants: mocks.grants });
        });
        vi.stubGlobal('crypto', { randomUUID: () => 'grant-a' });
    });

    it('loads labeled environment options and submits their ids as a multi-select value', async () => {
        const user = userEvent.setup();
        render(<WorkflowToolAccessDialog
            open
            tool={{
                hostId: 'host-a', toolId: 'tool-a', name: 'Order tool', version: '1.0.0',
                lightapiDigest: 'sha256:digest', lightapiValidationStatus: 'VALID',
            }}
            onClose={vi.fn()}
        />);

        await user.click(await screen.findByLabelText('Workflow'));
        await user.click(await screen.findByRole('option', { name: 'sales · Order flow' }));

        await user.click(screen.getByLabelText('Allowed Environments'));
        await user.click(await screen.findByRole('option', { name: 'Development' }));
        await user.click(await screen.findByRole('option', { name: 'Testing' }));
        await user.click(screen.getByRole('button', { name: 'Grant Access' }));

        await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledTimes(1));
        expect(mocks.fetchClient).toHaveBeenCalledWith('/r/data?name=environment&host=host-a');
        expect(mocks.apiPost.mock.calls[0][0].body.data).toMatchObject({
            hostId: 'host-a', grantId: 'grant-a', toolId: 'tool-a', wfDefId: 'workflow-a',
            allowedEnvironments: ['dev', 'test'],
        });
    });

    it('lists every grant for the Tool with its workflow identity', async () => {
        mocks.grants = [
            {
                grantId: 'grant-a', toolId: 'tool-a', wfDefId: 'workflow-a', workflowNamespace: 'sales',
                workflowName: 'Order flow', allowedEnvironments: ['dev'], aggregateVersion: 1,
            },
            {
                grantId: 'grant-b', toolId: 'tool-a', wfDefId: 'workflow-b', workflowNamespace: 'support',
                workflowName: 'Return flow', workflowVersion: '2.0.0', allowedEnvironments: ['test'], aggregateVersion: 1,
            },
        ];

        render(<WorkflowToolAccessDialog
            open
            tool={{ hostId: 'host-a', toolId: 'tool-a', name: 'Order tool', lightapiValidationStatus: 'VALID' }}
            onClose={vi.fn()}
        />);

        expect(await screen.findByText('sales · Order flow')).toBeInTheDocument();
        expect(screen.getByText('support · Return flow')).toBeInTheDocument();
        expect(screen.getByText('All versions')).toBeInTheDocument();
        expect(screen.getByText('Version 2.0.0')).toBeInTheDocument();

        const grantQuery = mocks.fetchClient.mock.calls
            .map(call => call[0] as string)
            .find(url => url.startsWith('/portal/query') && queryAction(url) === 'getWorkflowToolGrant');
        expect(grantQuery).toBeDefined();
        expect(queryData(grantQuery!)).toEqual({ hostId: 'host-a', toolId: 'tool-a', active: true });
    });
});
