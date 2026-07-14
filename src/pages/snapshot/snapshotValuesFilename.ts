import type { SnapshotValues } from './configSnapshotValues.types';

export function snapshotValuesFilename(snapshot: Pick<SnapshotValues, 'instanceName' | 'snapshotTs' | 'snapshotId'>) {
  return `values-${safeFilenamePart(snapshot.instanceName)}-${safeFilenamePart(snapshot.snapshotTs)}-${safeFilenamePart(snapshot.snapshotId)}.yml`;
}

function safeFilenamePart(value: string) {
  return (value || 'unknown').trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

