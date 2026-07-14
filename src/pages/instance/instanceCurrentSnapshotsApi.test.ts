import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CurrentConfigSnapshotsApiError,
  getCurrentConfigSnapshotsByInstances,
} from './instanceCurrentSnapshotsApi';

const hostId = '00000000-0000-4000-8000-000000000099';
const instanceIds = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
];

describe('current config snapshots API', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('preserves instance order and forwards the abort signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ jsonrpc: '2.0', result: response() }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const result = await getCurrentConfigSnapshotsByInstances({ hostId, instanceIds, signal: controller.signal });
    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(request.signal).toBe(controller.signal);
    expect(body.method).toBe('lightapi.net/config/getCurrentConfigSnapshotsByInstances/0.1.0');
    expect(body.params.instanceIds).toEqual(instanceIds);
    expect(result.snapshots.map(snapshot => snapshot.instanceId)).toEqual(instanceIds);
  });

  it.each([
    ['CURRENT_CONFIG_SNAPSHOT_UNAVAILABLE', 'no current'],
    ['CURRENT_CONFIG_SNAPSHOT_CARDINALITY', 'multiple current'],
    ['CURRENT_CONFIG_SNAPSHOT_FORBIDDEN', 'not authorized'],
    ['CURRENT_CONFIG_SNAPSHOT_MIXED_SERVICE', 'shared service'],
    ['CURRENT_CONFIG_SNAPSHOT_TOO_LARGE', 'fewer instances'],
  ])('maps %s to safe guidance', async (code, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ jsonrpc: '2.0', error: { code } }, 409)));
    await expect(getCurrentConfigSnapshotsByInstances({ hostId, instanceIds }))
      .rejects.toMatchObject({ name: 'CurrentConfigSnapshotsApiError', code, message: expect.stringContaining(expected) });
  });

  it('rejects a response whose order does not match the request', async () => {
    const body = response();
    body.snapshots.reverse();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ jsonrpc: '2.0', result: body })));
    await expect(getCurrentConfigSnapshotsByInstances({ hostId, instanceIds }))
      .rejects.toBeInstanceOf(CurrentConfigSnapshotsApiError);
  });
});

function response() {
  return {
    resolvedAt: '2026-07-14T12:00:00Z',
    comparisonLimits: { maxProperties: 10_000, maxResponseBytes: 5_242_880 },
    snapshots: instanceIds.map((instanceId, index) => ({
      hostId,
      instanceId,
      instanceName: `instance-${index + 1}`,
      serviceId: 'service-1',
      environment: index ? 'qa' : 'dev',
      snapshotId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      snapshotTs: '2026-07-14T12:00:00Z',
      propertyCount: 5,
    })),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
