import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishTestConfig } from '../../test/runtimeConfigFixture';

vi.mock('../../contexts/UserContext', () => ({ useUserState: () => ({ host: '', userId: '' }) }));
vi.mock('@uiw/react-codemirror', () => ({ default: ({ value }: { value: string }) =>
  <textarea aria-label="Workflow YAML source" value={value} readOnly /> }));
vi.mock('./WorkflowGraph', () => ({ default: () => <div>Workflow graph</div> }));
import WorkflowEditor from './WorkflowEditor';

const definition = `document:
  dsl: '1.0.3'
  namespace: test
  name: diagnostics
  version: '1.0.0'
do:
  - inspect:
      mcp:
        tool: intake
        arguments: {}
`;
const fetchMock = vi.fn();

beforeEach(() => {
  publishTestConfig({ routing: { apiBasePath: '/namespace-dev/service' } });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function show(path = '/diagnostics/tools') {
  render(<MemoryRouter initialEntries={[{ pathname: '/app/workflow/editor', state: { data: { definition } } }]}>
    <WorkflowEditor />
  </MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Diagnostics API-relative path'), { target: { value: path } });
  fireEvent.click(screen.getByRole('button', { name: 'Check Tools' }));
}
function respond(value: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }));
}

describe('Workflow runtime diagnostics paths', () => {
  it('uses GET and applies the configured API prefix exactly once', async () => {
    respond({ tools: [{ name: 'intake' }] });
    show('  /diagnostics/tools  ');
    expect(await screen.findByText('Runtime tools/list covers all referenced MCP tools.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(`${window.location.origin}/namespace-dev/service/diagnostics/tools`);
    expect(request.method).toBeUndefined(); // fetch defaults to GET
    expect(request.body).toBeUndefined();
    expect(request.credentials).toBe('include');
  });

  it('retains the MCP tools/list POST payload and JSON-RPC response handling', async () => {
    respond({ jsonrpc: '2.0', id: 'workflow-editor-tools-list', result: { tools: [{ name: 'intake' }] } });
    show('/mcp');
    expect(await screen.findByText('Runtime tools/list covers all referenced MCP tools.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(`${window.location.origin}/namespace-dev/service/mcp`);
    expect(request.method).toBe('POST');
    expect(JSON.parse(request.body)).toEqual({ jsonrpc: '2.0', method: 'tools/list', params: {}, id: 'workflow-editor-tools-list' });
  });

  it.each([
    'https://external.example.test/mcp', 'http://external.example.test/diagnostics/tools',
    `${window.location.origin}/mcp`, '//external.example.test/mcp',
    '/diagnostics\\tools', '\\mcp', '/diagnostics/../mcp', '/./mcp',
    'mcp', '',
  ])('rejects unsupported path %s before network dispatch', async path => {
    show(path);
    expect(await screen.findByText(/Enter an API-relative path beginning with a single/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves missing-tool result presentation', async () => {
    respond({ tools: [] });
    show();
    expect(await screen.findByText('1 referenced tool missing from runtime tools/list.')).toBeInTheDocument();
  });

  it('preserves gateway error presentation', async () => {
    respond({ gatewayError: 'Gateway is unavailable', tools: [] });
    show();
    expect(await screen.findByText('Gateway is unavailable')).toBeInTheDocument();
  });

  it('preserves request error presentation and does not replay', async () => {
    fetchMock.mockRejectedValue(new Error('Connection lost'));
    show();
    expect(await screen.findByText('Runtime diagnostics failed: Connection lost')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check Tools' })).toBeEnabled());
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
