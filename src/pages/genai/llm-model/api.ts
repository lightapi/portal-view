import { apiPost } from '../../../api/apiPost';
import fetchClient from '../../../utils/fetchClient';
import type { LlmRecord } from './types';

const rpc = (action: string, data: Record<string, unknown>) => ({
  host: 'lightapi.net', service: 'genai', action, version: '0.1.0', data,
});

const camel = (key: string) => key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => [camel(key), normalize(nested)]));
  }
  return value;
};

export async function queryLlm(action: string, data: Record<string, unknown>): Promise<unknown> {
  const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(rpc(action, data)));
  return normalize(await fetchClient(url));
}

export async function listLlm(action: string, hostId?: string, pageIdField?: string): Promise<LlmRecord[]> {
  const records: LlmRecord[] = [];
  const limit = 200;
  const seenIds = new Set<unknown>();
  for (let offset = 0; ; ) {
    const value = await queryLlm(action, {offset, limit, active: true, ...(hostId ? {hostId} : {})});
    if (!Array.isArray(value)) {
      if (pageIdField) throw new Error('Unable to load the complete route list.');
      return [];
    }
    if (pageIdField) {
      for (const row of value) {
        const id = row?.[pageIdField];
        if (typeof id !== 'string' || seenIds.has(id)) {
          throw new Error('Route pagination returned missing or repeated IDs. Reload the route list.');
        }
        seenIds.add(id);
      }
    }
    records.push(...value as LlmRecord[]);
    if (!pageIdField || value.length === 0) return records;
    offset += value.length;
  }
}

export async function commandLlm(action: string, data: LlmRecord): Promise<void> {
  const result = await apiPost({url: '/portal/command', headers: {}, body: rpc(action, data)});
  if (result?.error) throw new Error(result.error.message || result.error || `${action} failed`);
}
