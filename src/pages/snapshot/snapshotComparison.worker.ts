import { buildSnapshotComparison } from './snapshotComparison';
import type { SnapshotValues } from './configSnapshotValues.types';

export type SnapshotComparisonWorkerRequest = {
  generation: number;
  snapshots: SnapshotValues[];
};

export type SnapshotComparisonWorkerResponse = {
  generation: number;
  model?: ReturnType<typeof buildSnapshotComparison>;
  error?: string;
};

self.onmessage = (event: MessageEvent<SnapshotComparisonWorkerRequest>) => {
  try {
    self.postMessage({
      generation: event.data.generation,
      model: buildSnapshotComparison(event.data.snapshots),
    } satisfies SnapshotComparisonWorkerResponse);
  } catch {
    self.postMessage({
      generation: event.data.generation,
      error: 'Unable to prepare the comparison.',
    } satisfies SnapshotComparisonWorkerResponse);
  }
};

