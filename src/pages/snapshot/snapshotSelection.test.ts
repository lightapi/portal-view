import { describe, expect, it } from 'vitest';
import {
  canShowYamlDiff,
  comparisonSelectionIssue,
  parseSnapshotIds,
  showSnapshotHistory,
  snapshotSelectionKey,
  updateSelectedSnapshots,
} from './snapshotSelection';
import type { ConfigSnapshotSummary } from './configSnapshotValues.types';

describe('snapshot selection', () => {
  it('survives paging, rejects a fifth snapshot, and uses host-scoped identities', () => {
    const rows = Array.from({ length: 5 }, (_, index) => summary(index));
    let selected = new Map<string, ConfigSnapshotSummary>();
    for (const row of rows.slice(0, 4)) {
      selected = updateSelectedSnapshots(selected, [row], { [snapshotSelectionKey(row)]: true }).selected;
    }
    const fifth = updateSelectedSnapshots(selected, [rows[4]], { [snapshotSelectionKey(rows[4])]: true });
    expect(fifth.capped).toBe(true);
    expect(fifth.selected.size).toBe(4);
    expect(snapshotSelectionKey(rows[0])).toContain(`${rows[0].hostId}:`);
  });

  it('enforces service and configured property limits without hard-coded caps', () => {
    const rows = [summary(0), summary(1)];
    rows[0].propertyCount = 7;
    rows[1].propertyCount = 5;
    expect(comparisonSelectionIssue(rows, { maxProperties: 10, maxResponseBytes: 50 })).toContain('12');
    rows[1].serviceId = 'different';
    expect(comparisonSelectionIssue(rows, { maxProperties: 100, maxResponseBytes: 50 })).toContain('same service');
  });

  it('removes only current history filters and validates ordered URL ids', () => {
    expect(showSnapshotHistory([{ id: 'current', value: 'true' }, { id: 'instanceId', value: 'one' }]))
      .toEqual([{ id: 'instanceId', value: 'one' }]);
    const ids = [summary(0).snapshotId, summary(1).snapshotId];
    expect(parseSnapshotIds(ids.join(','))).toEqual(ids);
    expect(parseSnapshotIds(`${ids[0]},${ids[0]}`)).toBeNull();
    expect(canShowYamlDiff(2)).toBe(true);
    expect(canShowYamlDiff(3)).toBe(false);
  });
});

function summary(index: number): ConfigSnapshotSummary {
  return {
    snapshotId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    snapshotTs: `2024-01-0${index + 1}T00:00:00Z`,
    snapshotType: 'USER_SAVE',
    hostId: '00000000-0000-4000-8000-000000000099',
    instanceId: `instance-${index}`,
    instanceName: `instance-${index}`,
    current: false,
    description: null,
    serviceId: 'service-1',
    propertyCount: 1,
  };
}
