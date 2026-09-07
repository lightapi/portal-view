import { beforeEach, expect, it, vi } from 'vitest';
import fetchClient from './fetchClient';
import { fetchAllQueryRows } from './fetchAllQueryRows';
vi.mock('./fetchClient', () => ({default: vi.fn()}));
const fetch = vi.mocked(fetchClient);
beforeEach(() => fetch.mockReset());
it('finds relationships beyond the first 1000 and preserves server filters', async () => {
  fetch.mockResolvedValueOnce({instanceApis: Array.from({length:1000}, (_,id) => ({id}))})
    .mockResolvedValueOnce({instanceApis:[{id:1000}]});
  const filters = JSON.stringify([{id:'apiType',value:'agent'}]);
  const rows = await fetchAllQueryRows('instance','getInstanceApi',{filters},'instanceApis');
  expect(rows).toHaveLength(1001);
  expect(rows.at(-1)).toEqual({id:1000});
  const calls = fetch.mock.calls.map(([url]) => JSON.parse(decodeURIComponent(String(url).split('cmd=')[1])));
  expect(calls.map(c => c.data.offset)).toEqual([0,1000]);
  expect(calls.every(c => c.data.filters === filters)).toBe(true);
});
it('reads through an exact page boundary', async () => {
  fetch.mockResolvedValueOnce({instances:Array.from({length:1000},(_,id)=>({id}))})
    .mockResolvedValueOnce({instances:[]});
  expect(await fetchAllQueryRows('instance','getInstance',{},'instances')).toHaveLength(1000);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('never returns a partial success when a later page fails', async () => {
  fetch.mockResolvedValueOnce({agentDefinitions:Array.from({length:1000},(_,id)=>({id}))})
    .mockRejectedValueOnce(new Error('page failed'));
  await expect(fetchAllQueryRows('genai','getAgentDefinition',{},'agentDefinitions')).rejects.toThrow('page failed');
});
it('rejects a server repeating its first page', async () => {
  fetch.mockResolvedValue({instances:Array.from({length:1000},(_,id)=>({id}))});
  await expect(fetchAllQueryRows('instance','getInstance',{},'instances')).rejects.toThrow('did not advance');
});
