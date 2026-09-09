import { beforeEach, expect, it, vi } from 'vitest';
import { listLlm } from './api';
import fetchClient from '../../../utils/fetchClient';

vi.mock('../../../utils/fetchClient', () => ({default: vi.fn()}));
vi.mock('../../../api/apiPost', () => ({apiPost: vi.fn()}));
const fetchMock = vi.mocked(fetchClient);
const firstPage = Array.from({length:200}, (_, index) => ({
  alias_route_id:`route-${index}`, public_alias_id:'other-alias',
}));
beforeEach(() => fetchMock.mockReset());

it('includes alias routes beyond the first 200 records', async () => {
  fetchMock.mockResolvedValueOnce(firstPage).mockResolvedValueOnce([
    {alias_route_id:'target-route', public_alias_id:'target-alias'},
  ]).mockResolvedValueOnce([]);
  const rows = await listLlm('getLlmAliasRoute', 'host-a', 'aliasRouteId');
  expect(rows.filter(row => row.publicAliasId === 'target-alias')).toEqual([
    {aliasRouteId:'target-route', publicAliasId:'target-alias'},
  ]);
  const requests = fetchMock.mock.calls.map(([url]) =>
    JSON.parse(new URL(String(url), 'https://localhost').searchParams.get('cmd')!).data);
  expect(requests).toEqual([
    {hostId:'host-a',active:true,offset:0,limit:200},
    {hostId:'host-a',active:true,offset:200,limit:200},
    {hostId:'host-a',active:true,offset:201,limit:200},
  ]);
});

it('continues through full pages until an empty page', async () => {
  fetchMock.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(firstPage.map(row => ({...row,alias_route_id:`next-${row.alias_route_id}`}))).mockResolvedValueOnce([]);
  expect(await listLlm('getLlmAliasRoute', 'host-a', 'aliasRouteId')).toHaveLength(400);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it('fails rather than returning partial routes when a later page fails', async () => {
  fetchMock.mockResolvedValueOnce(firstPage).mockRejectedValueOnce(new Error('page failed'));
  await expect(listLlm('getLlmAliasRoute', 'host-a', 'aliasRouteId')).rejects.toThrow('page failed');
});

it('rejects malformed later pages rather than returning partial routes', async () => {
  fetchMock.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(null);
  await expect(listLlm('getLlmAliasRoute', 'host-a', 'aliasRouteId')).rejects.toThrow('complete route list');
});

it('keeps other resource lists on one page', async () => {
  fetchMock.mockResolvedValueOnce(firstPage);
  expect(await listLlm('getLlmPublicAlias', 'host-a')).toHaveLength(200);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('rejects repeated pages instead of looping or rendering duplicate routes', async () => {
  fetchMock.mockResolvedValue(firstPage);
  await expect(listLlm('getLlmAliasRoute', 'host-a', 'aliasRouteId')).rejects.toThrow('repeated IDs');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('advances by actual page size when the server cap is smaller', async () => {
  fetchMock.mockResolvedValueOnce(firstPage.slice(0, 2))
    .mockResolvedValueOnce(firstPage.slice(2, 3)).mockResolvedValueOnce([]);
  expect(await listLlm('renamedRouteAction', 'host-a', 'aliasRouteId')).toHaveLength(3);
  expect(fetchMock.mock.calls.map(([url]) =>
    JSON.parse(new URL(String(url), 'https://localhost').searchParams.get('cmd')!).data.offset))
    .toEqual([0, 2, 3]);
});
