import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConfigSnapshotValues, SnapshotValuesApiError } from './configSnapshotValuesApi';

describe('config snapshot values API', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('sends ordered ids, requested representations, and the abort signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      jsonrpc: '2.0',
      result: { configPhase: 'R', snapshots: [] },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    await getConfigSnapshotValues({
      hostId: 'host',
      snapshotIds: ['second', 'first'],
      include: ['entries', 'yaml'],
      signal: controller.signal,
    });
    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(request.signal).toBe(controller.signal);
    expect(body.method).toBe('lightapi.net/config/getConfigSnapshotValues/0.1.0');
    expect(body.params).toEqual({
      hostId: 'host',
      snapshotIds: ['second', 'first'],
      configPhase: 'R',
      include: ['entries', 'yaml'],
    });
  });

  it('turns an authoritative 413 into actionable guidance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      jsonrpc: '2.0',
      error: { statusCode: 413, code: 'CONFIG_SNAPSHOT_TOO_LARGE' },
    }, 413)));
    try {
      await getConfigSnapshotValues({ hostId: 'host', snapshotIds: ['one'], include: ['yaml'] });
      throw new Error('Expected request to fail');
    } catch (caught) {
      expect(caught).toBeInstanceOf(SnapshotValuesApiError);
      expect((caught as SnapshotValuesApiError).statusCode).toBe(413);
      expect((caught as SnapshotValuesApiError).message).toContain('Select fewer snapshots');
    }
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

