import { describe, expect, it } from 'vitest';
import { buildSnapshotComparison, reorderSnapshotIds } from './snapshotComparison';
import type { SnapshotValueEntry, SnapshotValues } from './configSnapshotValues.types';

const IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
];

describe('snapshot comparison', () => {
  it('ignores map order, preserves list order, and detects source-only changes', () => {
    const model = buildSnapshotComparison([
      snapshot(0, [entry('map', { b: 2, a: 1 }, 'map'), entry('list', ['a', 'b'], 'list'), entry('source', true, 'boolean', 'environment')]),
      snapshot(1, [entry('map', { a: 1, b: 2 }, 'map'), entry('list', ['b', 'a'], 'list'), entry('source', true, 'boolean', 'instance')]),
    ]);
    expect(status(model, 'map')).toBe('same');
    expect(status(model, 'list')).toBe('valueChanged');
    expect(status(model, 'source')).toBe('sourceChanged');
  });

  it('treats equal-looking cross-types as changed and missing has precedence', () => {
    const model = buildSnapshotComparison([
      snapshot(0, [entry('number', 1, 'integer'), entry('truth', 'true', 'string'), entry('missing', 1, 'integer')]),
      snapshot(1, [entry('number', 1, 'float'), entry('truth', true, 'boolean')]),
      snapshot(2, [entry('number', 2, 'integer'), entry('truth', true, 'boolean'), entry('missing', 2, 'integer')]),
    ]);
    expect(status(model, 'number')).toBe('valueChanged');
    expect(status(model, 'truth')).toBe('valueChanged');
    expect(status(model, 'missing')).toBe('missing');
  });

  it('builds sorted unions for two through four snapshots and chooses the oldest baseline', () => {
    for (let count = 2; count <= 4; count += 1) {
      const snapshots = Array.from({ length: count }, (_, index) => snapshot(index, [entry(`key-${count - index}`, index, 'integer')]));
      snapshots[1].snapshotTs = '2020-01-01T00:00:00Z';
      const model = buildSnapshotComparison(snapshots);
      expect(model.rows.map(row => row.key)).toEqual([...model.rows.map(row => row.key)].sort());
      expect(model.snapshotIds).toHaveLength(count);
      expect(model.baselineSnapshotId).toBe(IDS[1]);
    }
  });

  it('supports explicit column reordering and a synthetic 10,000-property union', () => {
    expect(reorderSnapshotIds(IDS.slice(0, 3), IDS[1], -1)).toEqual([IDS[1], IDS[0], IDS[2]]);
    const snapshots = IDS.map((_, snapshotIndex) => snapshot(snapshotIndex,
      Array.from({ length: 2500 }, (__, entryIndex) => entry(`${snapshotIndex}-${entryIndex}`, [entryIndex, { nested: true }], 'list'))));
    expect(buildSnapshotComparison(snapshots).rows).toHaveLength(10_000);
  });
});

function snapshot(index: number, entries: SnapshotValueEntry[]): SnapshotValues {
  return {
    snapshotId: IDS[index],
    snapshotTs: `2024-01-0${index + 1}T00:00:00Z`,
    snapshotType: 'USER_SAVE',
    hostId: '00000000-0000-4000-8000-000000000099',
    instanceId: `instance-${index}`,
    instanceName: `instance-${index}`,
    current: index === 0,
    description: null,
    serviceId: 'service-1',
    propertyCount: entries.length,
    sha256: 'sha256:test',
    entries,
  };
}

function entry(key: string, value: unknown, valueType: SnapshotValueEntry['valueType'], sourceLevel = 'instance'): SnapshotValueEntry {
  return { key, value, valueType, sourceLevel };
}

function status(model: ReturnType<typeof buildSnapshotComparison>, key: string) {
  return model.rows.find(row => row.key === key)?.status;
}

