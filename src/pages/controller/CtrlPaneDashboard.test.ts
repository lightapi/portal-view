import { describe, expect, it } from 'vitest';
import {
  appendBufferedNotification,
  applyNotificationToInstances,
  fetchRuntimeInstanceBaseline,
  instancesForCurrentHost,
  MAX_BUFFERED_NOTIFICATIONS,
  reconcileInstances,
  RuntimeInstanceView,
} from './CtrlPaneDashboard';

const baseline = (id: string): RuntimeInstanceView => ({
  runtimeInstanceId: id,
  serviceId: 'service-a',
  connected: false,
  active: true,
  connectedAt: '',
  lastSeenAt: '',
  liveStatus: 'unknown',
  metadata: { environment: 'dev', version: '1', protocol: 'https', port: 8443, address: 'host', tags: {} },
});

const matches = () => true;

describe('authoritative runtime list reconciliation', () => {
  it('overlays only hybrid-query IDs and never appends unmatched live snapshots', () => {
    const result = reconcileInstances(
      { authoritative: baseline('authoritative') },
      [
        { ...baseline('authoritative'), connected: true },
        { ...baseline('live-only'), connected: true },
      ],
      [], '', matches,
    );
    expect(Object.keys(result)).toEqual(['authoritative']);
    expect(result.authoritative.liveStatus).toBe('active');
  });

  it('never creates a row from live-only notifications', () => {
    const current = { authoritative: baseline('authoritative') };
    const result = applyNotificationToInstances(current, 'notifications/instance_connected', {
      instance: { ...baseline('live-only'), connected: true },
    }, [], '', matches);
    expect(result).toBe(current);
    expect(result['live-only']).toBeUndefined();
  });

  it('updates and disconnects an existing authoritative row', () => {
    const current = { authoritative: baseline('authoritative') };
    const connected = applyNotificationToInstances(current, 'notifications/instance_connected', {
      instance: { ...baseline('authoritative'), connected: true },
    }, [], '', matches);
    expect(connected.authoritative.liveStatus).toBe('active');
    const disconnected = applyNotificationToInstances(connected, 'notifications/instance_disconnected', {
      runtimeInstanceId: 'authoritative',
    }, [], '', matches);
    expect(disconnected.authoritative.liveStatus).toBe('inactive');
  });
});

describe('bounded notification buffering', () => {
  it('coalesces repeated updates for the same runtime to the newest event', () => {
    const buffer: Array<{ method: string; params: any }> = [];
    appendBufferedNotification(buffer, {
      method: 'notifications/instance_connected',
      params: { instance: { runtimeInstanceId: 'runtime-1', version: 1 } },
    });
    appendBufferedNotification(buffer, {
      method: 'notifications/instance_disconnected',
      params: { runtimeInstanceId: 'runtime-1', version: 2 },
    });

    expect(buffer).toHaveLength(1);
    expect(buffer[0].method).toBe('notifications/instance_disconnected');
    expect(buffer[0].params.version).toBe(2);
  });

  it('never grows beyond the authoritative query limit', () => {
    const buffer: Array<{ method: string; params: any }> = [];
    for (let index = 0; index <= MAX_BUFFERED_NOTIFICATIONS; index += 1) {
      appendBufferedNotification(buffer, {
        method: 'notifications/instance_connected',
        params: { instance: { runtimeInstanceId: `runtime-${index}` } },
      });
    }

    expect(buffer).toHaveLength(MAX_BUFFERED_NOTIFICATIONS);
    expect(buffer[0].params.instance.runtimeInstanceId).toBe('runtime-1');
  });
});

describe('host-scoped authoritative baseline', () => {
  it('hides the previous host immediately when host context changes', () => {
    const instances = { previous: baseline('previous') };
    expect(instancesForCurrentHost(instances, 'host-a', 'host-a')).toBe(instances);
    expect(instancesForCurrentHost(instances, 'host-a', 'host-b')).toEqual({});
  });

  it('propagates cancellation to a non-resolving baseline request', async () => {
    const controller = new AbortController();
    const client = (_url: string, options: any) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    const request = fetchRuntimeInstanceBaseline('/portal/query', controller.signal, client as any);
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
