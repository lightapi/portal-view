import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import forms from '../../data/Forms.json';
import Form from './Form';

const mocks = vi.hoisted(() => ({ fetchClient: vi.fn() }));

vi.mock('../../contexts/UserContext', () => ({
  useUserState: () => ({ host: 'host-a', isAuthenticated: true }),
}));
vi.mock('../../utils/fetchClient', () => ({ BASE_URL: '', default: mocks.fetchClient }));
vi.mock('../HelpLink', () => ({ default: () => null }));

const lookupOnlyHostForms = [
  'createOrg',
  'updateOrg',
  'createHost',
  'privateMessage',
  'createRefLocale',
  'createRefRelation',
];

function usesHostIdParameter(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(usesHostIdParameter);
  if (!value || typeof value !== 'object') return false;

  const item = value as Record<string, unknown>;
  const action = item.action as Record<string, unknown> | undefined;
  if (Array.isArray(action?.params) && action.params.includes('hostId')) return true;
  return Object.values(item).some(usesHostIdParameter);
}

describe('host-dependent form lookup context', () => {
  beforeEach(() => {
    mocks.fetchClient.mockReset();
    mocks.fetchClient.mockResolvedValue({});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ['en', 'fr'],
      ok: true,
      status: 200,
    }));
  });

  it('declares hostId for every host-dependent lookup', () => {
    const formDefinitions = forms as Record<string, any>;
    const mismatches = Object.entries(formDefinitions)
      .filter(([, definition]) => usesHostIdParameter(definition.form))
      .filter(([, definition]) => !definition.schema?.properties?.hostId)
      .map(([formId]) => formId);

    expect(mismatches).toEqual([]);
    for (const formId of lookupOnlyHostForms) {
      expect(formDefinitions[formId].schema.properties.hostId).toMatchObject({
        type: 'string',
        readonly: true,
      });
      expect(formDefinitions[formId].submitOmitFields).toContain('hostId');
    }
  });

  it('loads Ref Locale languages with the current host and omits hostId on submit', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/app/form/createRefLocale',
        state: { data: { valueId: 'value-a', language: 'en', valueLabel: 'English' } },
      }]}>
        <Routes>
          <Route path="/app/form/:formId" element={<Form />} />
          <Route path="/app/success" element={<output>success</output>} />
          <Route path="/app/failure" element={<output>failure</output>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Ref Locale' })).toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/r/data?name=language&host=host-a',
      expect.objectContaining({ credentials: 'include' }),
    ));

    await user.click(screen.getByRole('button', { name: 'Create Ref Locale' }));
    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].body.data).toEqual({
      valueId: 'value-a',
      language: 'en',
      valueLabel: 'English',
    });
  });
});
