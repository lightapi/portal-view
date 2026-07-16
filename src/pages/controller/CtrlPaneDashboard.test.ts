import { describe, expect, it } from 'vitest';
import { applyNotificationToInstances, reconcileInstances, RuntimeInstanceView } from './CtrlPaneDashboard';

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
