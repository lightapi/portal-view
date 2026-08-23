import type { SnapshotValueEntry, SnapshotValues, SnapshotValueType } from './configSnapshotValues.types';

export type SnapshotComparisonStatus = 'same' | 'valueChanged' | 'missing' | 'sourceChanged';

export type SnapshotComparisonCell = SnapshotValueEntry | null;

export type SnapshotComparisonRow = {
  key: string;
  status: SnapshotComparisonStatus;
  cells: Record<string, SnapshotComparisonCell>;
};

export type SnapshotComparisonDetailCell = {
  value: unknown;
  valueType: SnapshotValueType | 'null';
  sourceLevel: string;
};

export type SnapshotComparisonDetailRow = {
  key: string;
  parentKey: string;
  status: SnapshotComparisonStatus;
  cells: Record<string, SnapshotComparisonDetailCell | null>;
};

export type SnapshotComparisonModel = {
  baselineSnapshotId: string;
  snapshotIds: string[];
  rows: SnapshotComparisonRow[];
  detailRows: SnapshotComparisonDetailRow[];
};

export function buildSnapshotComparison(snapshots: SnapshotValues[]): SnapshotComparisonModel {
  if (snapshots.length < 2 || snapshots.length > 4) throw new Error('Comparison requires two to four snapshots');
  const entryMaps = snapshots.map(snapshot => new Map((snapshot.entries ?? []).map(entry => [entry.key, entry])));
  const keys = new Set<string>();
  for (const entries of entryMaps) for (const key of Array.from(entries.keys())) keys.add(key);

  const rows = Array.from(keys).sort().map(key => {
    const cells: Record<string, SnapshotComparisonCell> = {};
    const values = snapshots.map((snapshot, index) => {
      const entry = entryMaps[index].get(key) ?? null;
      cells[snapshot.snapshotId] = entry;
      return entry;
    });
    return { key, cells, status: classify(values) };
  });

  const detailEntryMaps = snapshots.map(snapshot => flattenEntries(snapshot.entries ?? []));
  const detailKeys = new Set<string>();
  for (const entries of detailEntryMaps) for (const key of Array.from(entries.keys())) detailKeys.add(key);
  const detailRows = Array.from(detailKeys).sort(compareDetailKeys).map(key => {
    const cells: Record<string, SnapshotComparisonDetailCell | null> = {};
    const values = snapshots.map((snapshot, index) => {
      const entry = detailEntryMaps[index].get(key) ?? null;
      cells[snapshot.snapshotId] = entry;
      return entry;
    });
    return {
      key,
      parentKey: values.find(value => value !== null)?.parentKey ?? key,
      cells,
      status: classifyDetail(values),
    };
  });

  return {
    baselineSnapshotId: oldestSnapshotId(snapshots),
    snapshotIds: snapshots.map(snapshot => snapshot.snapshotId),
    rows,
    detailRows,
  };
}

export function reorderSnapshotIds(ids: string[], snapshotId: string, direction: -1 | 1) {
  const next = [...ids];
  const index = next.indexOf(snapshotId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function typedValuesEqual(left: SnapshotValueEntry, right: SnapshotValueEntry) {
  return left.valueType === right.valueType && deepEqual(left.value, right.value);
}

function classify(values: SnapshotComparisonCell[]): SnapshotComparisonStatus {
  if (values.some(value => value === null)) return 'missing';
  const present = values as SnapshotValueEntry[];
  if (present.slice(1).some(value => !typedValuesEqual(present[0], value))) return 'valueChanged';
  if (present.slice(1).some(value => value.sourceLevel !== present[0].sourceLevel)) return 'sourceChanged';
  return 'same';
}

type FlattenedDetailCell = SnapshotComparisonDetailCell & { parentKey: string };

function flattenEntries(entries: SnapshotValueEntry[]) {
  const flattened = new Map<string, FlattenedDetailCell>();
  for (const entry of entries) {
    flattenValue(flattened, entry.key, entry.key, entry.value, entry.sourceLevel, entry.valueType);
  }
  return flattened;
}

function flattenValue(
  flattened: Map<string, FlattenedDetailCell>,
  parentKey: string,
  path: string,
  value: unknown,
  sourceLevel: string,
  declaredValueType?: SnapshotValueType,
) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      flattened.set(path, { parentKey, value, valueType: 'list', sourceLevel });
      return;
    }
    value.forEach((item, index) => flattenValue(flattened, parentKey, `${path}[${index}]`, item, sourceLevel));
    return;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    if (keys.length === 0) {
      flattened.set(path, { parentKey, value, valueType: 'map', sourceLevel });
      return;
    }
    for (const key of keys) {
      flattenValue(flattened, parentKey, `${path}${mapKeySegment(key)}`, value[key], sourceLevel);
    }
    return;
  }
  flattened.set(path, { parentKey, value, valueType: declaredValueType ?? detailValueType(value), sourceLevel });
}

function mapKeySegment(key: string) {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
}

function detailValueType(value: unknown): SnapshotComparisonDetailCell['valueType'] {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'float';
  return 'string';
}

function classifyDetail(values: Array<FlattenedDetailCell | null>): SnapshotComparisonStatus {
  if (values.some(value => value === null)) return 'missing';
  const present = values as FlattenedDetailCell[];
  if (present.slice(1).some(value => value.valueType !== present[0].valueType || !deepEqual(value.value, present[0].value))) {
    return 'valueChanged';
  }
  if (present.slice(1).some(value => value.sourceLevel !== present[0].sourceLevel)) return 'sourceChanged';
  return 'same';
}

function compareDetailKeys(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true });
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => deepEqual(value, right[index]));
  }
  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key, index) => key === rightKeys[index] && deepEqual(left[key], right[key]));
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function oldestSnapshotId(snapshots: SnapshotValues[]) {
  return [...snapshots].sort((left, right) => {
    const leftTime = Date.parse(left.snapshotTs);
    const rightTime = Date.parse(right.snapshotTs);
    const timeOrder = Number.isFinite(leftTime) && Number.isFinite(rightTime)
      ? leftTime - rightTime
      : left.snapshotTs.localeCompare(right.snapshotTs);
    return timeOrder || left.snapshotId.localeCompare(right.snapshotId);
  })[0].snapshotId;
}
