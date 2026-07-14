import type { MRT_ColumnFiltersState } from 'material-react-table';
import type { MRT_RowSelectionState } from 'material-react-table';
import type { ConfigSnapshotSummary, SnapshotComparisonLimits } from './configSnapshotValues.types';

export const MAX_COMPARE_SNAPSHOTS = 4;

export function snapshotSelectionKey(snapshot: Pick<ConfigSnapshotSummary, 'hostId' | 'snapshotId'>) {
  return `${snapshot.hostId}:${snapshot.snapshotId}`;
}

export function selectedPropertyCount(snapshots: Iterable<ConfigSnapshotSummary>) {
  let total = 0;
  for (const snapshot of Array.from(snapshots)) total += snapshot.propertyCount ?? 0;
  return total;
}

export function comparisonSelectionIssue(
  snapshots: ConfigSnapshotSummary[],
  limits: SnapshotComparisonLimits,
): string | null {
  if (snapshots.length < 2) return 'Select at least two snapshots.';
  if (snapshots.length > MAX_COMPARE_SNAPSHOTS) return 'Select no more than four snapshots.';
  if (new Set(snapshots.map(snapshot => snapshot.serviceId)).size > 1) {
    return 'Selected snapshots must have the same service id.';
  }
  const total = selectedPropertyCount(snapshots);
  if (total > limits.maxProperties) {
    return `Cannot compare ${total.toLocaleString()} properties; the server limit is ${limits.maxProperties.toLocaleString()}.`;
  }
  return null;
}

export function showSnapshotHistory(filters: MRT_ColumnFiltersState): MRT_ColumnFiltersState {
  return filters.filter(filter => filter.id !== 'current');
}

export function updateSelectedSnapshots(
  current: Map<string, ConfigSnapshotSummary>,
  pageRows: ConfigSnapshotSummary[],
  nextSelection: MRT_RowSelectionState,
  max = MAX_COMPARE_SNAPSHOTS,
) {
  const selected = new Map(current);
  let capped = false;
  for (const snapshot of pageRows) {
    const key = snapshotSelectionKey(snapshot);
    if (!nextSelection[key]) selected.delete(key);
    else if (!selected.has(key)) {
      if (selected.size >= max) capped = true;
      else selected.set(key, snapshot);
    }
  }
  return { selected, capped };
}

export function canShowYamlDiff(snapshotCount: number) {
  return snapshotCount === 2;
}

export function parseSnapshotIds(value: string | null): string[] | null {
  if (!value) return null;
  const ids = value.split(',').map(id => id.trim()).filter(Boolean);
  if (ids.length < 2 || ids.length > MAX_COMPARE_SNAPSHOTS || new Set(ids).size !== ids.length) return null;
  return ids.every(isUuid) ? ids : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
