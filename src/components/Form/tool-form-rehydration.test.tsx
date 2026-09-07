import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import Form from './Form';
// Same fixture asserted against both real query handlers in genai-query/ToolEditorQueryTest.
import editorRecord from './tool-editor-record.json';

const mocks = vi.hoisted(() => ({fetchClient: vi.fn()}));
vi.mock('../../contexts/UserContext', () => ({useUserState: () => ({host: 'host-a', isAuthenticated: true})}));
vi.mock('../../utils/fetchClient', () => ({BASE_URL: '', default: mocks.fetchClient}));
vi.mock('../HelpLink', () => ({default: () => null}));

describe('Update Tool query-to-form contract', () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue({});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, status: 200, json: async () => []}));
  });
  it('displays query-enriched metadata and submits an object without form-specific normalization', async () => {
    render(<MemoryRouter initialEntries={[{
      pathname: '/app/form/updateTool', state: {data: structuredClone(editorRecord)},
    }]}><Routes>
      <Route path="/app/form/:formId" element={<Form/>}/>
      <Route path="/app/success" element={<div>Success</div>}/>
    </Routes></MemoryRouter>);
    expect(await screen.findByRole('checkbox', {name: 'Read Only'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Idempotent'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Destructive'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Human Approval Required'})).toBeChecked();
    expect(screen.getByRole('textbox', {name: 'Semantic Description'})).toHaveValue('Customer search');
    expect(screen.getByRole('textbox', {name: 'Semantic Keywords'})).toHaveValue('customer, policy');
    expect(screen.getByRole('textbox', {name: 'Estimated Latency Ms'})).toHaveValue('120');
    await userEvent.click(screen.getByRole('checkbox', {name: 'Read Only'}));
    await userEvent.click(screen.getByRole('button', {name: 'Update Tool Form'}));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledWith('/portal/command', expect.anything()));
    const data = mocks.fetchClient.mock.calls.find(([url]) => url === '/portal/command')?.[1].body.data;
    expect(data.toolMetadata).toEqual(editorRecord.toolMetadata);
    expect(data.readOnly).toBe(false);
    expect(typeof data.toolMetadata).toBe('object');
  });
});
