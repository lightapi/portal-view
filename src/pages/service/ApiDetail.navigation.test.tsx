import { renderWithActionDisplay as render } from '../../test/renderWithActionDisplay';
import { selectPortalAction } from '../../test/portalActions';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ApiDetail from './ApiDetail';
import { apiPost } from '../../api/apiPost';

vi.mock('../../api/apiPost', () => ({ apiPost: vi.fn(async () => ({ data: {} })) }));

vi.mock('../../contexts/UserContext', () => ({
  useUserState: () => ({ host: 'host-a', userId: 'user-a', roles: 'admin' }),
}));
vi.mock('../../utils/fetchClient', () => ({ default: vi.fn(async () => [{
  hostId: 'host-a', apiId: 'api-a', apiVersionId: 'version-a', apiVersion: '1.0.0', apiType: 'agt',
}]) }));
vi.mock('../../components/Widget/Widget', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('../../tasks/TaskActionPanel', () => ({ default: () => null }));
vi.mock('./ApiGatewayPublicationDialog', () => ({ default: () => null }));
vi.mock('material-react-table', () => ({
  useMaterialReactTable: (config: unknown) => config,
  MaterialReactTable: ({ table }: { table: {
    data: Array<{ apiVersionId: string }>;
    renderRowActions: (args: { row: { original: unknown } }) => ReactNode;
  } }) => <div>{table.data.map((row) => <div key={row.apiVersionId}>{table.renderRowActions({ row: { original: row } })}</div>)}</div>,
}));
function Destination() {
  const location = useLocation();
  return <div data-testid="destination">{location.search}</div>;
}
describe('API version edit navigation', () => {
  it('deletes using the stable API version UUID required by the event aggregate', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MemoryRouter initialEntries={[{
      pathname: '/app/apiDetail', state: { service: { hostId: 'host-a', apiId: 'api-a', active: true } },
    }]}><ApiDetail /></MemoryRouter>);
    await selectPortalAction('Delete Api Version');
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    expect(vi.mocked(apiPost).mock.calls.at(-1)?.[0].body.data).toMatchObject({
      hostId: 'host-a', apiId: 'api-a', apiVersion: '1.0.0', apiVersionId: 'version-a',
    });
    confirm.mockRestore();
  });
  it.each(['', '?task=register-ai-agent&taskStep=version&returnTo=%2Fapp%2Ftasks%2Fregister-ai-agent'])(
    'passes record identity with task context %s', async (search) => {
      render(<MemoryRouter initialEntries={[{
        pathname: '/app/apiDetail', search, state: { service: { hostId: 'host-a', apiId: 'api-a', active: true } },
      }]}><Routes>
        <Route path="/app/apiDetail" element={<ApiDetail />} />
        <Route path="/app/form/updateApiVersion" element={<Destination />} />
      </Routes></MemoryRouter>);
      await selectPortalAction('Update Api Version');
      const params = new URLSearchParams((await screen.findByTestId('destination')).textContent ?? '');
      expect(params.get('hostId')).toBe('host-a');
      expect(params.get('apiId')).toBe('api-a');
      expect(params.get('apiVersionId')).toBe('version-a');
      expect(params.get('task')).toBe(search ? 'register-ai-agent' : null);
      if (search) expect(params.get('taskStep')).toBe('version');
    },
  );
});
