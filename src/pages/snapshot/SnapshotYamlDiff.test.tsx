import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import SnapshotYamlDiff from './SnapshotYamlDiff';
import { snapshotYamlDiffExtensions, YAML_DIFF_SCAN_LIMIT, YAML_DIFF_TIMEOUT_MS } from './snapshotYamlDiffConfig';
import { getConfigSnapshotValues } from './configSnapshotValuesApi';

const merge = vi.hoisted(() => ({ configs: [] as Array<Record<string, unknown>>, destroy: vi.fn() }));

vi.mock('@codemirror/merge', () => ({
  MergeView: class {
    a = {};
    b = {};
    constructor(config: Record<string, unknown>) { merge.configs.push(config); }
    destroy() { merge.destroy(); }
  },
  goToNextChunk: vi.fn(),
  goToPreviousChunk: vi.fn(),
}));
vi.mock('./configSnapshotValuesApi', () => ({
  getConfigSnapshotValues: vi.fn(),
  verifySnapshotYamlDigest: vi.fn(() => Promise.resolve(true)),
}));

describe('SnapshotYamlDiff', () => {
  it('lazy-load target is read-only, bounded, and destroyed on unmount', async () => {
    vi.mocked(getConfigSnapshotValues).mockResolvedValue({
      configPhase: 'R',
      snapshots: [snapshot('one'), snapshot('two')],
    });
    const view = render(<SnapshotYamlDiff hostId="host" snapshotIds={['one', 'two']} />);
    await waitFor(() => expect(merge.configs).toHaveLength(1));
    expect(merge.configs[0].diffConfig).toEqual({ scanLimit: YAML_DIFF_SCAN_LIMIT, timeout: YAML_DIFF_TIMEOUT_MS });
    const state = EditorState.create({ extensions: snapshotYamlDiffExtensions(false) });
    expect(state.facet(EditorState.readOnly)).toBe(true);
    expect(state.facet(EditorView.editable)).toBe(false);
    view.unmount();
    expect(merge.destroy).toHaveBeenCalledOnce();
  });
});

function snapshot(snapshotId: string) {
  return {
    snapshotId,
    snapshotTs: '2024-01-01T00:00:00Z',
    snapshotType: 'USER_SAVE',
    hostId: 'host',
    instanceId: snapshotId,
    instanceName: snapshotId,
    current: false,
    description: null,
    serviceId: 'service',
    propertyCount: 1,
    sha256: 'sha256:test',
    yaml: `${snapshotId}: true\n`,
  };
}
