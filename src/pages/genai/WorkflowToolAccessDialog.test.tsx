import { render, screen } from '@testing-library/react';
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

    it('keeps new grant creation in the Workflow Editor approval flow', async () => {
        render(<WorkflowToolAccessDialog
            open
            tool={{
                hostId: 'host-a', toolId: 'tool-a', name: 'Order tool', version: '1.0.0',
                lightapiDigest: 'sha256:digest', lightapiValidationStatus: 'VALID',
            }}
            onClose={vi.fn()}
        />);

        expect(await screen.findByText(/New access is requested from the Workflow Editor/)).toBeInTheDocument();
        expect(screen.queryByLabelText('Workflow')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Grant Access' })).not.toBeInTheDocument();
        expect(mocks.apiPost).not.toHaveBeenCalled();
    });

    it('lists every grant for the Tool with its workflow identity', async () => {
        mocks.grants = [
            {
                grantId: 'grant-a', toolId: 'tool-a', wfDefId: 'workflow-a', workflowNamespace: 'sales',
                workflowName: 'Order flow', allowedEnvironments: ['dev'], aggregateVersion: 1,
            },
            {
                grantId: 'grant-b', toolId: 'tool-a', wfDefId: 'workflow-b', workflowNamespace: 'support',
                workflowName: 'Return flow', allowedEnvironments: ['test'], aggregateVersion: 1,
            },
        ];

        render(<WorkflowToolAccessDialog
            open
            tool={{ hostId: 'host-a', toolId: 'tool-a', name: 'Order tool', lightapiValidationStatus: 'VALID' }}
            onClose={vi.fn()}
        />);

        expect(await screen.findByText('sales · Order flow')).toBeInTheDocument();
        expect(screen.getByText('support · Return flow')).toBeInTheDocument();
        expect(screen.getAllByText('Definition-wide')).toHaveLength(2);

        const grantQuery = mocks.fetchClient.mock.calls
            .map(call => call[0] as string)
            .find(url => url.startsWith('/portal/query') && queryAction(url) === 'getWorkflowToolGrant');
        expect(grantQuery).toBeDefined();
        expect(queryData(grantQuery!)).toEqual({ hostId: 'host-a', toolId: 'tool-a', active: true });
    });
});
