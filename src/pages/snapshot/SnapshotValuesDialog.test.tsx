import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SnapshotValuesDialog from './SnapshotValuesDialog';
import { snapshotValuesFilename } from './snapshotValuesFilename';
import { getConfigSnapshotValues } from './configSnapshotValuesApi';
import downloadText from '../../utils/downloadText';
import type { ConfigSnapshotSummary, SnapshotValues } from './configSnapshotValues.types';

vi.mock('./configSnapshotValuesApi', () => ({
  getConfigSnapshotValues: vi.fn(),
  verifySnapshotYamlDigest: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../../utils/downloadText', () => ({ default: vi.fn() }));

const summary: ConfigSnapshotSummary = {
  snapshotId: '00000000-0000-4000-8000-000000000001',
  snapshotTs: '2024-01-01T00:00:00Z',
  snapshotType: 'USER_SAVE',
  hostId: 'host',
  instanceId: 'instance',
  instanceName: 'Gateway / Dev',
  current: false,
  description: null,
  serviceId: 'service',
  propertyCount: 1,
};
const loaded: SnapshotValues = { ...summary, sha256: 'sha256:test', yaml: 'server:\n  port: 8080\n' };

describe('SnapshotValuesDialog', () => {
  beforeEach(() => {
    vi.mocked(getConfigSnapshotValues).mockResolvedValue({ configPhase: 'R', snapshots: [loaded] });
  });

  it('copies and downloads the exact API bytes without using browser storage', async () => {
    const localStorageSet = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<MemoryRouter><SnapshotValuesDialog hostId="host" snapshot={summary} onClose={vi.fn()} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(writeText).toHaveBeenCalledWith(loaded.yaml);
    expect(downloadText).toHaveBeenCalledWith(
      'values-Gateway-Dev-2024-01-01T00-00-00Z-00000000-0000-4000-8000-000000000001.yml',
      loaded.yaml,
      'application/yaml;charset=utf-8',
    );
    expect(localStorageSet).not.toHaveBeenCalled();
  });

  it('sanitizes output filenames', () => {
    expect(snapshotValuesFilename(loaded)).not.toMatch(/[/:]/);
  });

  it('renders the YAML preview with readable contrasting colors', async () => {
    render(<MemoryRouter><SnapshotValuesDialog hostId="host" snapshot={summary} onClose={vi.fn()} /></MemoryRouter>);

    const preview = await screen.findByLabelText('values.yml preview');
    expect(preview).toHaveStyle({
      backgroundColor: 'rgb(33, 33, 33)',
      color: 'rgb(245, 245, 245)',
    });
  });
});
