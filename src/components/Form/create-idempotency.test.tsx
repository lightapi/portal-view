import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import forms from '../../data/Forms';
import Form from './Form';

const mocks = vi.hoisted(() => ({
  fetchClient: vi.fn(),
}));

vi.mock('../../contexts/UserContext', () => ({
  useUserState: () => ({host: '00000000-0000-0000-0000-000000000001', isAuthenticated: true}),
}));

vi.mock('../../utils/fetchClient', () => ({
  BASE_URL: '',
  default: mocks.fetchClient,
}));

vi.mock('../HelpLink', () => ({default: () => null}));

function RouteResult() {
  const location = useLocation();
  return <output data-testid="route-result">{location.pathname}</output>;
}

function renderCategory() {
  return render(
    <MemoryRouter initialEntries={[{
      pathname: '/app/form/createCategory',
      state: {data: {
        hostId: '00000000-0000-0000-0000-000000000001',
        entityType: 'schema',
        categoryName: 'runtime',
      }},
    }]}>
      <Routes>
        <Route path="/app/form/:formId" element={<Form/>}/>
        <Route path="/app/success" element={<RouteResult/>}/>
        <Route path="/app/failure" element={<RouteResult/>}/>
      </Routes>
    </MemoryRouter>,
  );
}

describe('create-form idempotency', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.fetchClient.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => [],
      ok: true,
      status: 200,
    }));
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValue('00000000-0000-4000-8000-000000000123');
  });

  it('opts the Category and Tag create actions into retry protection', () => {
    expect(forms.createCategory.actions[0].idempotentCreate).toBe(true);
    expect(forms.createTag.actions[0].idempotentCreate).toBe(true);
  });

  it('blocks double submit and sends one standard idempotency key', async () => {
    let complete: ((value: unknown) => void) | undefined;
    mocks.fetchClient.mockReturnValue(new Promise((resolve) => {
      complete = resolve;
    }));
    renderCategory();
    const button = await screen.findByRole('button', {name: 'Create Category'});

    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
    expect(mocks.fetchClient.mock.calls[0][1].headers['Idempotency-Key'])
      .toBe('00000000-0000-4000-8000-000000000123');
    expect(button).toBeDisabled();
    complete?.({categoryId: '00000000-0000-0000-0000-000000000456'});
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/success');
  });

  it('preserves the form and reuses the key after an uncertain failure', async () => {
    const user = userEvent.setup();
    mocks.fetchClient
      .mockRejectedValueOnce({code: 'NETWORK_OUTCOME_UNKNOWN'})
      .mockResolvedValueOnce({categoryId: '00000000-0000-0000-0000-000000000456'});
    renderCategory();
    const button = await screen.findByRole('button', {name: 'Create Category'});

    await user.click(button);
    expect(await screen.findByText(/NETWORK_OUTCOME_UNKNOWN/)).toBeInTheDocument();
    expect(screen.queryByTestId('route-result')).not.toBeInTheDocument();
    await user.click(button);

    await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(2));
    expect(mocks.fetchClient.mock.calls[0][1].headers['Idempotency-Key'])
      .toBe(mocks.fetchClient.mock.calls[1][1].headers['Idempotency-Key']);
    expect(await screen.findByTestId('route-result')).toHaveTextContent('/app/success');
  });
});
