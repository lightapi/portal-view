import { describe, expect, it, vi } from 'vitest';
import { createSnapshotComparisonWorkerClient, type ComparisonWorker } from './snapshotComparisonWorkerClient';

describe('snapshot comparison worker client', () => {
  it('ignores stale replies and terminates on dispose', async () => {
    const worker = fakeWorker();
    const client = createSnapshotComparisonWorkerClient(() => worker);
    const first = client.calculate([]);
    const second = client.calculate([]);
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    const onMessage = worker.onmessage as ((event: MessageEvent) => void) | null;
    onMessage?.({ data: { generation: 1, model: { baselineSnapshotId: 'stale', snapshotIds: [], rows: [] } } } as MessageEvent);
    onMessage?.({ data: { generation: 2, model: { baselineSnapshotId: 'current', snapshotIds: [], rows: [] } } } as MessageEvent);
    await expect(second).resolves.toMatchObject({ baselineSnapshotId: 'current' });
    client.dispose();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});

function fakeWorker(): ComparisonWorker {
  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
  };
}
