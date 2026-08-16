import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchClient: vi.fn() }));

vi.mock('@uiw/react-codemirror', () => ({
    default: ({ value }: { value?: string }) => <textarea aria-label="Workflow YAML source" value={value || ''} readOnly />,
}));

vi.mock('../../contexts/UserContext', () => ({
    useUserState: () => ({ host: 'host-a', userId: 'user-1' }),
}));

vi.mock('../../utils/fetchClient', () => ({ default: mocks.fetchClient }));
vi.mock('./WorkflowGraph', () => ({ default: () => <div data-testid="workflow-graph" /> }));

import WorkflowEditor from './WorkflowEditor';

function queryCommand(url: string) {
    const parsed = new URL(url, 'https://portal.test');
    return JSON.parse(parsed.searchParams.get('cmd') || '{}') as {
        action?: string;
        data?: Record<string, unknown>;
    };
}

describe('WorkflowEditor environment selector', () => {
    beforeEach(() => {
        mocks.fetchClient.mockReset();
        mocks.fetchClient.mockImplementation((url: string) => {
            if (url === '/r/data?name=environment&host=host-a') {
                return Promise.resolve([
                    { id: 'dev', label: 'Development' },
                    { id: 'loc', label: 'Local' },
                    { id: 'demo', label: 'Demo' },
                ]);
            }
            const command = queryCommand(url);
            if (command.action === 'getWfDefinitionById') {
                return Promise.resolve({
                    hostId: 'host-a', wfDefId: 'workflow-a', namespace: 'test', name: 'selector-test',
                    version: '1.0.0', definition: 'document:\n  name: selector-test\ndo: []\n',
                    lifecycleStatus: 'DRAFT', versions: [],
                });
            }
            return Promise.resolve({});
        });
    });

    it('loads a single-select list, maps local to loc, and refreshes callable Tools with the selected id', async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={[{
                pathname: '/app/workflow/editor',
                state: { data: {
                    hostId: 'host-a', wfDefId: 'workflow-a', namespace: 'test', name: 'selector-test',
                    version: '1.0.0', definition: 'document:\n  name: selector-test\ndo: []\n',
                    lifecycleStatus: 'DRAFT',
                } },
            }]}
            >
                <Routes>
                    <Route path="/app/workflow/editor" element={<WorkflowEditor />} />
                </Routes>
            </MemoryRouter>,
        );

        const selector = await screen.findByRole('combobox', { name: 'Environment' });
        await waitFor(() => expect(selector).toHaveTextContent('Local'));

        await user.click(selector);
        await user.click(await screen.findByRole('option', { name: 'Demo' }));

        await waitFor(() => expect(mocks.fetchClient.mock.calls.some(([url]) => {
            if (typeof url !== 'string' || !url.startsWith('/portal/query')) return false;
            const command = queryCommand(url);
            return command.action === 'getWorkflowCallableTool' && command.data?.environment === 'demo';
        })).toBe(true));

        await user.click(screen.getByRole('combobox', { name: 'Reference Type' }));
        await user.click(await screen.findByRole('option', { name: 'API Endpoints' }));
        const reference = screen.getByRole('combobox', { name: 'Reference' });
        expect(reference).toBeEnabled();
        await user.click(reference);
        expect(await screen.findByText('No API endpoints are granted for this workflow, version, and demo environment.')).toBeInTheDocument();
    });

    it('loads every Tool page and filters identifiable API labels from the Reference dropdown', async () => {
        mocks.fetchClient.mockImplementation((url: string) => {
            if (url === '/r/data?name=environment&host=host-a') {
                return Promise.resolve([{ id: 'loc', label: 'Local' }]);
            }
            const command = queryCommand(url);
            if (command.action === 'getWfDefinitionById') {
                return Promise.resolve({
                    hostId: 'host-a', wfDefId: 'workflow-a', namespace: 'test', name: 'selector-test',
                    version: '1.0.0', definition: 'document:\n  name: selector-test\ndo: []\n',
                    lifecycleStatus: 'DRAFT', versions: [],
                });
            }
            if (command.action === 'getTool') {
                if (command.data?.offset === 500) {
                    return Promise.resolve({ total: 501, tools: [{
                        toolId: 'tool-501', name: 'createOrder', apiName: 'Orders API', apiVersion: '2.1.0',
                        apiMethod: 'post', apiEndpoint: '/orders',
                    }] });
                }
                return Promise.resolve({ total: 501, tools: [{ toolId: 'tool-1', name: 'healthCheck' }] });
            }
            return Promise.resolve({});
        });

        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={[{
                pathname: '/app/workflow/editor',
                state: { data: {
                    hostId: 'host-a', wfDefId: 'workflow-a', namespace: 'test', name: 'selector-test',
                    version: '1.0.0', definition: 'document:\n  name: selector-test\ndo: []\n',
                    lifecycleStatus: 'DRAFT',
                } },
            }]}
            >
                <Routes>
                    <Route path="/app/workflow/editor" element={<WorkflowEditor />} />
                </Routes>
            </MemoryRouter>,
        );

        const referenceType = screen.getByRole('combobox', { name: 'Reference Type' });
        expect(referenceType).toHaveTextContent('MCP Tools');
        await user.click(referenceType);
        expect(await screen.findByRole('option', { name: 'API Endpoints' })).toBeInTheDocument();
        await user.keyboard('{Escape}');

        const reference = await screen.findByRole('combobox', { name: 'Reference' });
        await waitFor(() => expect(reference).toBeEnabled());
        await user.type(reference, 'orders');

        const label = 'Orders API · 2.1.0 · createOrder · POST · /orders';
        await user.click(await screen.findByRole('option', { name: label }));
        await user.click(screen.getByRole('button', { name: 'Insert Reference' }));

        const source = (screen.getByLabelText('Workflow YAML source') as HTMLTextAreaElement).value;
        expect(source).toContain('call-createorder:');
        expect(source).toContain('tool: createOrder');
        expect(mocks.fetchClient.mock.calls.some(([url]) => {
            if (typeof url !== 'string' || !url.startsWith('/portal/query')) return false;
            const command = queryCommand(url);
            return command.action === 'getTool' && command.data?.offset === 500;
        })).toBe(true);
    });
});
