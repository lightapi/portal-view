import { describe, expect, it } from 'vitest';
import {
  instanceComparisonIssue,
  instanceSelectionKey,
  updateSelectedInstances,
} from './instanceCurrentSnapshotSelection';
import type { InstanceComparisonCandidate } from './instanceCurrentSnapshots.types';

describe('current snapshot instance selection', () => {
  it('preserves selection across pages and caps the selection at four', () => {
    const rows = Array.from({ length: 5 }, (_, index) => candidate(index));
    let selected = new Map<string, InstanceComparisonCandidate>();
    for (const row of rows.slice(0, 4)) {
      selected = updateSelectedInstances(selected, [row], { [instanceSelectionKey(row)]: true }).selected;
    }
    const fifth = updateSelectedInstances(selected, [rows[4]], { [instanceSelectionKey(rows[4])]: true });
    expect(fifth.capped).toBe(true);
    expect(fifth.selected.size).toBe(4);
    expect(Array.from(fifth.selected.values()).map(row => row.instanceId)).toEqual(rows.slice(0, 4).map(row => row.instanceId));
  });

  it('requires a non-empty common service without considering instance current state', () => {
    const rows = [candidate(0), candidate(1)];
    rows[0].current = false;
    rows[1].current = true;
    expect(instanceComparisonIssue(rows)).toBeNull();
    rows[1].serviceId = 'other-service';
    expect(instanceComparisonIssue(rows)).toContain('same service');
    rows[1].serviceId = ' ';
    expect(instanceComparisonIssue(rows)).toContain('service id');
  });
});

function candidate(index: number): InstanceComparisonCandidate {
  return {
    hostId: '00000000-0000-4000-8000-000000000099',
    instanceId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    instanceName: `instance-${index + 1}`,
    serviceId: 'service-1',
    envTag: index ? 'qa' : 'dev',
    current: false,
  };
}
