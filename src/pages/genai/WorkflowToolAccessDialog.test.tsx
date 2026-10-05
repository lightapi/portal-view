import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkflowToolAccessDialog from './WorkflowToolAccessDialog';

const mocks = vi.hoisted(() => ({
    apiPost: vi.fn(),
    fetchClient: vi.fn(),
    grants: [] as Array<Record<string, unknown>>,
    sync: {} as Record<string, unknown>,
    broad: {} as Record<string, unknown>,
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
        mocks.sync = {};
        mocks.broad = {};
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
            if (queryAction(url) === 'getToolWorkflowAccess') return Promise.resolve(mocks.broad);
            return Promise.resolve({ grants: mocks.grants, ...(queryData(url)?.wfDefId ? mocks.sync : {}) });
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

    it('shows pending grant synchronization and blocked revision errors', async () => {
        mocks.grants = [{grantId: 'grant-a', toolId: 'tool-a', wfDefId: 'workflow-a',
            allowedEnvironments: ['dev'], aggregateVersion: 1}];
        mocks.sync = {grantSyncStatus: 'pending'};
        const props = {open: true, tool: {hostId: 'host-a', toolId: 'tool-a', name: 'Order tool',
            lightapiValidationStatus: 'VALID'}, onClose: vi.fn()};
        const view = render(<WorkflowToolAccessDialog {...props} />);
        expect(await screen.findByText(/Sync pending/)).toBeInTheDocument();
        mocks.sync = {grantSyncStatus: 'error', grantSyncErrorCode: 'WORKFLOW_SYNC_REVISION_CONFLICT',
            grantSyncErrorMessage: 'Revision differs'};
        view.rerender(<WorkflowToolAccessDialog {...props} tool={{...props.tool, name: 'Order tool updated'}} />);
        expect(await screen.findByText(/WORKFLOW_SYNC_REVISION_CONFLICT: Revision differs — requires investigation/)).toBeInTheDocument();
        mocks.sync = {grantSyncStatus: 'error', grantSyncErrorCode: 'WORKFLOW_SYNC_REVISION_AHEAD',
            grantSyncErrorMessage: 'Remote revision is ahead'};
        view.rerender(<WorkflowToolAccessDialog {...props} tool={{...props.tool, name: 'Order tool refreshed'}} />);
        expect(await screen.findByText(/WORKFLOW_SYNC_REVISION_AHEAD: Remote revision is ahead — requires investigation/)).toBeInTheDocument();
    });
    it('keeps loaded grants visible when one definition status is unavailable', async () => {
        mocks.grants = [{grantId: 'grant-a', toolId: 'tool-a', wfDefId: 'workflow-a',
            allowedEnvironments: ['dev'], aggregateVersion: 1}];
        mocks.fetchClient.mockImplementation((url: string) => queryData(url)?.wfDefId
            ? Promise.reject(new Error('status unavailable')) : Promise.resolve({grants: mocks.grants}));
        render(<WorkflowToolAccessDialog open tool={{hostId: 'host-a', toolId: 'tool-a', name: 'Order tool',
            lightapiValidationStatus: 'VALID'}} onClose={vi.fn()} />);
        expect(await screen.findByText(/workflow-a: Sync status unavailable/)).toBeInTheDocument();
        expect(screen.getByText('Existing workflow grants')).toBeInTheDocument();
        expect(screen.getAllByText('workflow-a')).toHaveLength(2);
    });
    it('enables reviewed pins before workflows exist without creating a specific grant', async () => {
        render(<WorkflowToolAccessDialog open tool={{hostId:'host-a',toolId:'tool-a',name:'GitHub',version:'1.0.0',
            capabilityRef:'GITHUB/getIssue',lightapiDigest:'sha256:reviewed',lightapiValidationStatus:'VALID'}} onClose={vi.fn()} />);
        await screen.findByText('Broad access disabled');
        fireEvent.click(screen.getByRole('button',{name:'Enable reviewed version'}));
        await waitFor(()=>expect(mocks.apiPost).toHaveBeenCalledTimes(1));
        expect(mocks.apiPost.mock.calls[0][0].body).toMatchObject({action:'setToolWorkflowAccess',data:{hostId:'host-a',
            toolId:'tool-a',capabilityRef:'GITHUB/getIssue',toolVersion:'1.0.0',lightapiDigest:'sha256:reviewed',
            allowedEnvironments:['dev'],allowedMethods:['GET'],enabled:true,aggregateVersion:0}});
    });
    it('shows renewal and disables only broad permission, leaving specific grants visible', async () => {
        mocks.broad={enabled:true,renewalNeeded:true,aggregateVersion:2,toolVersion:'1.0.0',lightapiDigest:'sha256:old',
            allowedEnvironments:['dev'],allowedMethods:['GET'],syncStatus:'synced'};
        mocks.grants=[{grantId:'grant-a',toolId:'tool-a',wfDefId:'demo3',workflowName:'demo3',allowedEnvironments:['dev'],aggregateVersion:1}];
        render(<WorkflowToolAccessDialog open tool={{hostId:'host-a',toolId:'tool-a',name:'GitHub',version:'2.0.0',
            capabilityRef:'GITHUB/getIssue',lightapiDigest:'sha256:new',lightapiValidationStatus:'VALID'}} onClose={vi.fn()} />);
        await screen.findByText('Renewal needed — Tool pins changed');
        expect(screen.getByRole('button',{name:'Renew reviewed version'})).toBeInTheDocument();
        expect(screen.getByText(/Explicit workflow grants and already accepted runs remain authorized/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button',{name:'Disable broad access'}));
        await waitFor(()=>expect(mocks.apiPost).toHaveBeenCalledTimes(1));
        expect(mocks.apiPost.mock.calls[0][0].body).toMatchObject({action:'setToolWorkflowAccess',data:{enabled:false,aggregateVersion:2}});
        expect(screen.getByRole('button',{name:'Revoke'})).toBeInTheDocument();
    });
    it('retries publication without manufacturing a new approval', async () => {
        mocks.broad={enabled:true,aggregateVersion:1,syncStatus:'pending'};
        render(<WorkflowToolAccessDialog open tool={{hostId:'host-a',toolId:'tool-a',name:'GitHub',lightapiValidationStatus:'VALID'}} onClose={vi.fn()} />);
        fireEvent.click(await screen.findByRole('button',{name:'Retry publication'}));
        await waitFor(()=>expect(mocks.apiPost).toHaveBeenCalledTimes(1));
        expect(mocks.apiPost.mock.calls[0][0].body).toMatchObject({action:'publishToolWorkflowAccess',data:{hostId:'host-a',toolId:'tool-a'}});
    });
    it.each(['pending', 'error'])('does not claim a %s disable is operationally disabled', async syncStatus => {
        mocks.broad = {enabled: false, effectiveEnabled: false, syncStatus};
        render(<WorkflowToolAccessDialog open tool={{hostId:'host-a',toolId:'tool-a',name:'GitHub',lightapiValidationStatus:'VALID'}} onClose={vi.fn()} />);
        expect(await screen.findByText('Disable pending publication')).toBeInTheDocument();
        expect(screen.getByText(/previous operational policy may still authorize fresh starts/)).toBeInTheDocument();
        expect(screen.queryByText('Broad access disabled')).not.toBeInTheDocument();
    });
    it('labels a confirmed disable as disabled', async () => {
        mocks.broad = {enabled: false, syncStatus: 'synced'};
        render(<WorkflowToolAccessDialog open tool={{hostId:'host-a',toolId:'tool-a',name:'GitHub',lightapiValidationStatus:'VALID'}} onClose={vi.fn()} />);
        await waitFor(() => expect(screen.getByText(/Operational publication: synced/)).toBeInTheDocument());
        expect(screen.getByText('Broad access disabled')).toBeInTheDocument();
    });
    it.each(['Enable reviewed version', 'Retry publication', 'Revoke'])('does not report success for an aborted %s command', async button => {
        mocks.apiPost.mockResolvedValue({aborted: true});
        mocks.broad = {enabled: true, syncStatus: 'pending'};
        mocks.grants = [{grantId:'grant-a',toolId:'tool-a',wfDefId:'workflow-a',allowedEnvironments:['dev'],aggregateVersion:1}];
        render(<WorkflowToolAccessDialog open tool={{hostId:'host-a',toolId:'tool-a',name:'GitHub',lightapiValidationStatus:'VALID'}} onClose={vi.fn()} />);
        fireEvent.click(await screen.findByRole('button', {name:button}));
        expect(await screen.findByText(/Command outcome unconfirmed/)).toBeInTheDocument();
        expect(screen.queryByText(/Policy saved|Workflow access revoked/)).not.toBeInTheDocument();
        expect(mocks.fetchClient.mock.calls.filter(([url]) => queryAction(url) === 'getToolWorkflowAccess').length).toBeGreaterThan(1);
    });

});
