import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({fetchClient: vi.fn(), apiPost: vi.fn(), start: vi.fn(), sync: vi.fn()}));
vi.mock('../../contexts/UserContext', () => ({useUserState: () => ({host: 'host-a', userId: 'owner-a'})}));
vi.mock('../../utils/fetchClient', () => ({default: mocks.fetchClient}));
vi.mock('../../api/apiPost', () => ({apiPost: mocks.apiPost}));
vi.mock('./workflowPortalClient', async importOriginal => {
  const original = await importOriginal<typeof import('./workflowPortalClient')>();
  return {...original, workflowPortalClient: {start: mocks.start, sync: mocks.sync}};
});
vi.mock('@uiw/react-codemirror', () => ({default: ({value, onChange}: {value: string; onChange?: (value: string) => void}) =>
  <textarea aria-label="Workflow YAML source" value={value} onChange={event => onChange?.(event.target.value)} />}));
vi.mock('./WorkflowGraph', () => ({default: () => <div>Workflow graph</div>}));
import WorkflowEditor from './WorkflowEditor';

const definition = `document:\n  dsl: '1.0.3'\n  namespace: test\n  name: order-flow\n  version: '1.0.0'\nevaluate:\n  language: cel\ndo:\n  - finish:\n      set:\n        value: 1\n`;
const row = {hostId: 'host-a', wfDefId: 'definition-a', namespace: 'test', name: 'order-flow',
  version: '1.0.0', definition, lifecycleStatus: 'DRAFT', aggregateVersion: 2,
  ownerUserId: 'owner-a', active: true, versions: [{version: '1.0.0', definition,
    lifecycleStatus: 'DRAFT', aggregateVersion: 2}]};
let currentRow: any = row;

function action(url: string) {
  const command = new URL(url, 'https://portal.test').searchParams.get('cmd');
  return command ? JSON.parse(command).action : '';
}
function show() {
  render(<MemoryRouter initialEntries={[{pathname: '/app/workflow/editor', state: {data: currentRow}}]}>
    <Routes><Route path="/app/workflow/editor" element={<WorkflowEditor />} /></Routes>
  </MemoryRouter>);
}

beforeEach(() => {
  currentRow = row;
  mocks.fetchClient.mockReset().mockImplementation((url: string) => {
    if (action(url) === 'getWfDefinitionById') return Promise.resolve(currentRow);
    if (action(url) === 'validateWfDefinition') return Promise.resolve({valid: true, problems: [],
      schemaId: 'https://agentic-workflow.org/schemas/1.0.3/workflow.yaml', schemaVersion: '1.0.3',
      schemaDigest: 'a'.repeat(64)});
    return Promise.resolve({});
  });
  mocks.apiPost.mockReset().mockResolvedValue({data: {aggregateVersion: 3}});
  mocks.start.mockReset().mockRejectedValue({code: 'WORKFLOW_SYNC_REVISION_CONFLICT', message: 'Revision differs'});
  mocks.sync.mockReset().mockResolvedValue({definitionRevision: 2, grantRevision: 1});
  vi.stubGlobal('crypto', {randomUUID: vi.fn().mockReturnValue('attempt-a')});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('Step 11 Workflow editor', () => {
  it('shows the revision difference and lets the user retry sync', async () => {
    currentRow = {...row, definitionSync: {desiredRevision: 2, acknowledgedRevision: 1, status: 'pending'},
      grantSync: {desiredRevision: 1, acknowledgedRevision: 1, status: 'synced'}};
    show();
    expect(await screen.findByText(/Definition: Portal revision 2/)).toBeInTheDocument();
    expect(screen.getByText(/Workflow acknowledged 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Sync now'}));
    await waitFor(() => expect(mocks.sync).toHaveBeenCalledWith('host-a', 'definition-a'));
  });
  it('keeps Sync now available when Save sync and status refresh both fail', async () => {
    let statusAvailable = true;
    mocks.fetchClient.mockImplementation((url: string) => {
      if (action(url) === 'getWfDefinitionById') return statusAvailable
        ? Promise.resolve(currentRow) : Promise.reject(new Error('status unavailable'));
      if (action(url) === 'validateWfDefinition') return Promise.resolve({valid: true, problems: [],
        schemaId: 'https://agentic-workflow.org/schemas/1.0.3/workflow.yaml', schemaVersion: '1.0.3',
        schemaDigest: 'a'.repeat(64)});
      return Promise.resolve({});
    });
    mocks.sync.mockRejectedValueOnce(new Error('sync unavailable'));
    show();
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledWith(expect.stringContaining('getWfDefinitionById')));
    statusAvailable = false;
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    expect(await screen.findByText(/saved locally; sync is pending/)).toBeInTheDocument();
    const syncButton = await screen.findByRole('button', {name: 'Sync now'});
    expect(syncButton).toBeEnabled();

    currentRow = {...row, definitionSync: {desiredRevision: 3, acknowledgedRevision: 3, status: 'synced'},
      grantSync: {desiredRevision: 1, acknowledgedRevision: 1, status: 'synced'}};
    statusAvailable = true;
    fireEvent.click(syncButton);
    await waitFor(() => expect(mocks.sync).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Workflow definition and grants are synced.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', {name: 'Sync now'})).not.toBeInTheDocument());
  });
  it('keeps Sync now available when Publish sync and status refresh both fail', async () => {
    currentRow = {...row, definitionSync: {desiredRevision: 2, acknowledgedRevision: 2, status: 'synced'},
      grantSync: {desiredRevision: 1, acknowledgedRevision: 1, status: 'synced'}};
    let statusAvailable = true;
    mocks.fetchClient.mockImplementation((url: string) => {
      if (action(url) === 'getWfDefinitionById') return statusAvailable
        ? Promise.resolve(currentRow) : Promise.reject(new Error('status unavailable'));
      if (action(url) === 'validateWfDefinition') return Promise.resolve({valid: true, problems: [],
        schemaId: 'https://agentic-workflow.org/schemas/1.0.3/workflow.yaml', schemaVersion: '1.0.3',
        schemaDigest: 'a'.repeat(64)});
      return Promise.resolve({});
    });
    mocks.apiPost.mockResolvedValueOnce({error: {code: 'WORKFLOW_MCP_UNAVAILABLE', message: 'sync unavailable'}});
    show();
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledWith(expect.stringContaining('getWfDefinitionById')));
    expect(screen.queryByRole('button', {name: 'Sync now'})).not.toBeInTheDocument();
    statusAvailable = false;
    fireEvent.click(screen.getByRole('button', {name: 'Publish Version'}));
    expect(await screen.findByText(/Sync status is unconfirmed/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Sync now'})).toBeEnabled();

    currentRow = {...currentRow, definitionSync: {desiredRevision: 3, acknowledgedRevision: 3, status: 'synced'}};
    statusAvailable = true;
    fireEvent.click(screen.getByRole('button', {name: 'Sync now'}));
    await waitFor(() => expect(mocks.sync).toHaveBeenCalledWith('host-a', 'definition-a'));
    expect(await screen.findByText('Workflow definition and grants are synced.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', {name: 'Sync now'})).not.toBeInTheDocument());
  });
  it('keeps the same Portal Start key on retry after a sync error and never falls back', async () => {
    show();
    await screen.findByText('Workflow graph');
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledWith(expect.stringContaining('getWfDefinitionById')));
    fireEvent.click(screen.getByRole('button', {name: 'Test'}));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/WORKFLOW_SYNC_REVISION_CONFLICT/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Test'}));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(2));
    expect(mocks.start).toHaveBeenNthCalledWith(1, 'host-a', 'definition-a', {}, 'attempt-a');
    expect(mocks.start).toHaveBeenNthCalledWith(2, 'host-a', 'definition-a', {}, 'attempt-a');
    const validations = mocks.fetchClient.mock.calls.filter(([url]) => action(url) === 'validateWfDefinition');
    expect(validations).toHaveLength(2);
    for (const [url] of validations) expect(JSON.parse(new URL(url, 'https://portal.test').searchParams.get('cmd')!).data.validationMode)
      .toBe('EXECUTION');
  });
  it('sends reapprove when checked', async () => {
    show();
    await screen.findByText('Workflow graph');
    fireEvent.click(screen.getByLabelText('Require re-approval of Tool bindings for this version'));
    fireEvent.click(screen.getByRole('button', {name: 'Publish Version'}));
    await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledWith(expect.objectContaining({body: expect.objectContaining({
      action: 'publishWfDefinition', data: expect.objectContaining({bindingApproval: 'reapprove'}),
    })})));
  });
  it('can retry publication of an already frozen version after an outage', async () => {
    currentRow = {...row, lifecycleStatus: 'PUBLISHED', versions: [{...row.versions[0], lifecycleStatus: 'PUBLISHED'}]};
    show();
    await screen.findByText('Workflow graph');
    fireEvent.click(screen.getByRole('button', {name: 'Retry frozen publication'}));
    await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledWith(expect.objectContaining({body: expect.objectContaining({
      action: 'publishWfDefinition', data: expect.objectContaining({bindingApproval: 'carryOver'}),
    })})));
  });
  it('reports a completed retired definition receipt without active publication success', async () => {
    mocks.apiPost.mockResolvedValueOnce({data: {workflowPublication: {result: 'unchanged', status: 'retired'}}});
    show();
    await screen.findByText('Workflow graph');
    fireEvent.click(screen.getByRole('button', {name: 'Publish Version'}));
    expect(await screen.findByText(/remains retired in Workflow/)).toBeInTheDocument();
    expect(screen.queryByText('Workflow version 1.0.0 published and frozen.')).not.toBeInTheDocument();
  });
  it('leaves an aborted publication unconfirmed instead of freezing the version', async () => {
    mocks.apiPost.mockResolvedValueOnce({aborted: true});
    show();
    await screen.findByText('Workflow graph');
    fireEvent.click(screen.getByRole('button', {name: 'Publish Version'}));
    expect(await screen.findByText(/Publication request aborted; outcome unconfirmed/)).toBeInTheDocument();
    expect(screen.queryByText('Workflow version 1.0.0 published and frozen.')).not.toBeInTheDocument();
  });
  it('keeps the unsaved-revision guard before Portal Start', async () => {
    show();
    await screen.findByText('Workflow graph');
    fireEvent.change(screen.getByLabelText('Workflow YAML source'),
      {target: {value: definition.replace('value: 1', 'value: 2')}});
    fireEvent.click(screen.getByRole('button', {name: 'Test'}));
    expect(await screen.findByText('Save this exact workflow revision before starting it.')).toBeInTheDocument();
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
