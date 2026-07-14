import type { SnapshotValues } from './configSnapshotValues.types';
import type { SnapshotComparisonModel } from './snapshotComparison';
import type { SnapshotComparisonWorkerRequest, SnapshotComparisonWorkerResponse } from './snapshotComparison.worker';

export type ComparisonWorker = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror'>;

export function createSnapshotComparisonWorkerClient(
  workerFactory: () => ComparisonWorker = () => new Worker(
    new URL('./snapshotComparison.worker.ts', import.meta.url),
    { type: 'module' },
  ),
) {
  const worker = workerFactory();
  let generation = 0;
  let pending: {
    generation: number;
    resolve: (model: SnapshotComparisonModel) => void;
    reject: (error: Error) => void;
  } | null = null;

  worker.onmessage = (event: MessageEvent<SnapshotComparisonWorkerResponse>) => {
    if (!pending || event.data.generation !== pending.generation) return;
    const current = pending;
    pending = null;
    if (event.data.model) current.resolve(event.data.model);
    else current.reject(new Error(event.data.error ?? 'Unable to prepare the comparison.'));
  };
  worker.onerror = () => {
    pending?.reject(new Error('Unable to prepare the comparison.'));
    pending = null;
  };

  return {
    calculate(snapshots: SnapshotValues[]) {
      pending?.reject(new DOMException('Superseded', 'AbortError'));
      const currentGeneration = ++generation;
      return new Promise<SnapshotComparisonModel>((resolve, reject) => {
        pending = { generation: currentGeneration, resolve, reject };
        worker.postMessage({ generation: currentGeneration, snapshots } satisfies SnapshotComparisonWorkerRequest);
      });
    },
    dispose() {
      pending?.reject(new DOMException('Disposed', 'AbortError'));
      pending = null;
      generation += 1;
      worker.terminate();
    },
  };
}

