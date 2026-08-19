import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchClient: vi.fn(), apiPost: vi.fn() }));

vi.mock('@uiw/react-codemirror', () => ({
    default: ({ value }: { value?: string }) => <textarea aria-label="Workflow YAML source" value={value || ''} readOnly />,
}));

vi.mock('../../contexts/UserContext', () => ({
    useUserState: () => ({ host: 'host-a', userId: 'user-1' }),
}));

vi.mock('../../utils/fetchClient', () => ({ default: mocks.fetchClient }));
vi.mock('../../api/apiPost', () => ({ apiPost: mocks.apiPost }));
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
        mocks.apiPost.mockReset();
        mocks.apiPost.mockResolvedValue({ data: {} });
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

    it('does not create a workflow on page load and loads endpoint references without a workflow id', async () => {
        mocks.fetchClient.mockImplementation((url: string) => {
            if (url === '/r/data?name=environment&host=host-a') {
                return Promise.resolve([{ id: 'loc', label: 'Local' }]);
            }
            const command = queryCommand(url);
            if (command.action === 'getWorkflowReferenceTool') {
                return Promise.resolve({ tools: [{
                    toolId: '019c0000-0000-7000-8000-000000000001',
                    capabilityRef: 'customer-profile/profile.get',
                    apiName: 'Customer Profile API',
                    apiVersion: '1.0.0',
                    name: 'Get profile',
                    httpMethod: 'GET',
                    endpointPath: '/customers/{customerId}',
                    toolVersion: '1.0.0',
                    lightapiDigest: `sha256:${'a'.repeat(64)}`,
                    accessStatus: 'REQUESTABLE',
                    allowedEnvironments: ['loc'],
                }] });
            }
            return Promise.resolve({});
        });

        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={['/app/workflow/editor']}>
                <Routes>
                    <Route path="/app/workflow/editor" element={<WorkflowEditor />} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => expect(mocks.fetchClient.mock.calls.some(([url]) => {
            if (typeof url !== 'string' || !url.startsWith('/portal/query')) return false;
            const command = queryCommand(url);
            return command.action === 'getWorkflowReferenceTool'
                && !Object.prototype.hasOwnProperty.call(command.data || {}, 'wfDefId');
        })).toBe(true));
        expect(mocks.apiPost).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Request Tool Access' })).toBeDisabled();
        expect((screen.getByLabelText('Workflow YAML source') as HTMLTextAreaElement).value)
            .toContain('name: new-workflow\n');

        await user.click(screen.getByRole('combobox', { name: 'Reference Type' }));
        await user.click(await screen.findByRole('option', { name: 'API Endpoints' }));
        await user.click(screen.getByRole('combobox', { name: 'Reference' }));
        expect(await screen.findByRole('option', {
            name: 'Customer Profile API · 1.0.0 · Get profile · GET · /customers/{customerId}',
        })).toBeInTheDocument();
    });

    it('uses createWfDefinition only for the first explicit save', async () => {
        mocks.apiPost.mockResolvedValue({ data: {
            wfDefId: '019c0000-0000-7000-8000-000000000099',
            newAggregateVersion: 1,
        } });
        mocks.fetchClient.mockImplementation((url: string) => {
            if (url === '/r/data?name=environment&host=host-a') {
                return Promise.resolve([{ id: 'loc', label: 'Local' }]);
            }
            const command = queryCommand(url);
            if (command.action === 'validateWfDefinition') {
                return Promise.resolve({
                    valid: true,
                    problems: [],
                    schemaId: 'https://agentic-workflow.org/schemas/1.0.3/workflow.yaml',
                    schemaVersion: '1.0.3',
                    schemaDigest: 'a'.repeat(64),
                });
            }
            return Promise.resolve({});
        });

        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={['/app/workflow/editor']}>
                <Routes>
                    <Route path="/app/workflow/editor" element={<WorkflowEditor />} />
                </Routes>
            </MemoryRouter>,
        );

        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledTimes(1));
        const command = mocks.apiPost.mock.calls[0][0].body;
        expect(command.action).toBe('createWfDefinition');
        expect(command.data).not.toHaveProperty('wfDefId');
    });

    it('keeps Tool access disabled until newly inserted endpoint references are saved', async () => {
        const savedDefinition = `document:
  dsl: "1.0.3"
  namespace: test
  name: saved-workflow
  version: "1.0.0"
evaluate:
  language: cel
do: []
`;
        const savedWorkflow = {
            hostId: 'host-a',
            wfDefId: '019c0000-0000-7000-8000-000000000099',
            namespace: 'test',
            name: 'saved-workflow',
            version: '1.0.0',
            definition: savedDefinition,
            lifecycleStatus: 'DRAFT',
            aggregateVersion: 1,
            versions: [],
        };
        mocks.apiPost.mockResolvedValue({ data: { newAggregateVersion: 2 } });
        mocks.fetchClient.mockImplementation((url: string) => {
            if (url === '/r/data?name=environment&host=host-a') {
                return Promise.resolve([{ id: 'loc', label: 'Local' }]);
            }
            const command = queryCommand(url);
            if (command.action === 'getWfDefinitionById') return Promise.resolve(savedWorkflow);
            if (command.action === 'getWorkflowReferenceTool') {
                return Promise.resolve({ tools: [{
                    toolId: '019c0000-0000-7000-8000-000000000001',
                    capabilityRef: 'customer-profile/profile.get',
                    apiName: 'Customer Profile API',
                    apiVersion: '1.0.0',
                    name: 'Get profile',
                    httpMethod: 'GET',
                    endpointPath: '/customers/{customerId}',
                    toolVersion: '1.0.0',
                    lightapiDigest: `sha256:${'a'.repeat(64)}`,
                    accessStatus: 'REQUESTABLE',
                    allowedEnvironments: ['loc'],
                }] });
            }
            if (command.action === 'validateWfDefinition') {
                return Promise.resolve({
                    valid: true,
                    problems: [{ severity: 'warning', message: `WORKFLOW_TOOL_ACCESS_REQUIRED: tool-id|customer-profile/profile.get|1.0.0|sha256:${'a'.repeat(64)}` }],
                    schemaId: 'https://agentic-workflow.org/schemas/1.0.3/workflow.yaml',
                    schemaVersion: '1.0.3',
                    schemaDigest: 'a'.repeat(64),
                });
            }
            return Promise.resolve({});
        });

        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={[{ pathname: '/app/workflow/editor', state: { data: savedWorkflow } }]}>
                <Routes>
                    <Route path="/app/workflow/editor" element={<WorkflowEditor />} />
                </Routes>
            </MemoryRouter>,
        );

        await user.click(screen.getByRole('combobox', { name: 'Reference Type' }));
        await user.click(await screen.findByRole('option', { name: 'API Endpoints' }));
        await user.click(screen.getByRole('combobox', { name: 'Reference' }));
        await user.click(await screen.findByRole('option', {
            name: 'Customer Profile API · 1.0.0 · Get profile · GET · /customers/{customerId}',
        }));
        await user.click(screen.getByRole('button', { name: 'Insert Reference' }));

        const requestAccess = screen.getByRole('button', { name: 'Request Tool Access' });
        expect(requestAccess).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledWith(expect.objectContaining({
            body: expect.objectContaining({ action: 'updateWfDefinition' }),
        })));
        await waitFor(() => expect(requestAccess).toBeEnabled());
    });

    it('loads a single-select list, maps local to loc, and refreshes reference Tools with the selected id', async () => {
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
            return command.action === 'getWorkflowReferenceTool' && command.data?.selectedEnvironment === 'demo';
        })).toBe(true));

        await user.click(screen.getByRole('combobox', { name: 'Reference Type' }));
        await user.click(await screen.findByRole('option', { name: 'API Endpoints' }));
        const reference = screen.getByRole('combobox', { name: 'Reference' });
        expect(reference).toBeEnabled();
        await user.click(reference);
        expect(await screen.findByText('No eligible API endpoints are available for demo.')).toBeInTheDocument();
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
