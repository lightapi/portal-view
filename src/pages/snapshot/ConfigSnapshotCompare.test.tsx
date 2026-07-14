import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConfigSnapshotCompare from './ConfigSnapshotCompare';
import { getConfigSnapshotValues } from './configSnapshotValuesApi';
import { getCurrentConfigSnapshotsByInstances } from '../instance/instanceCurrentSnapshotsApi';

vi.mock('../../contexts/UserContext', () => ({
  useUserState: () => ({ host: '00000000-0000-4000-8000-000000000099' }),
}));
vi.mock('./configSnapshotValuesApi', () => ({ getConfigSnapshotValues: vi.fn() }));
vi.mock('../instance/instanceCurrentSnapshotsApi', () => ({ getCurrentConfigSnapshotsByInstances: vi.fn() }));
vi.mock('./snapshotComparisonWorkerClient', () => ({
  createSnapshotComparisonWorkerClient: () => ({
    calculate: (snapshots: Array<{ snapshotId: string }>) => Promise.resolve({
      snapshotIds: snapshots.map(snapshot => snapshot.snapshotId),
      baselineSnapshotId: snapshots[0].snapshotId,
      rows: [],
    }),
    dispose: vi.fn(),
  }),
}));

const snapshotIds = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
];
const instanceIds = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
];

describe('ConfigSnapshotCompare current-instances source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfigSnapshotValues).mockResolvedValue({
      configPhase: 'R',
      snapshots: snapshotIds.map((snapshotId, index) => ({
        snapshotId,
        snapshotTs: '2026-07-14T12:00:00Z',
        snapshotType: 'USER_SAVE',
        hostId: '00000000-0000-4000-8000-000000000099',
        instanceId: instanceIds[index],
        instanceName: `instance-${index + 1}`,
        current: index === 0,
        description: null,
        environment: index ? 'qa' : 'dev',
        serviceId: 'service-1',
        propertyCount: 5,
        sha256: `sha256:${index}`,
        entries: [],
      })),
    });
  });

  it('shows immutable-artifact warning and retains state when refresh resolves the same ids', async () => {
    vi.mocked(getCurrentConfigSnapshotsByInstances).mockResolvedValue(resolverResponse(snapshotIds));
    renderPage();
    expect(await screen.findByText('Current snapshots across instances')).toBeInTheDocument();
    expect(screen.getByText(/at least one resolved snapshot is no longer current/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh current snapshots' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Refresh current snapshots' }));
    await waitFor(() => expect(getCurrentConfigSnapshotsByInstances).toHaveBeenCalled());
    expect(await screen.findByText(/already contains the current snapshots/i)).toBeInTheDocument();
    expect(getCurrentConfigSnapshotsByInstances).toHaveBeenCalledWith(expect.objectContaining({ instanceIds }));
    expect(screen.getByTestId('location')).toHaveTextContent(snapshotIds.join(','));
  });

  it('keeps the old URL and comparison when refresh fails', async () => {
    vi.mocked(getCurrentConfigSnapshotsByInstances).mockRejectedValue(new Error('Current snapshots are unavailable.'));
    renderPage();
    await screen.findByText('Current snapshots across instances');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh current snapshots' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Refresh current snapshots' }));
    await waitFor(() => expect(getCurrentConfigSnapshotsByInstances).toHaveBeenCalled());
    expect(await screen.findByText(/existing comparison has not changed/i)).toBeInTheDocument();
    expect(screen.getByText('instance-1')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(snapshotIds.join(','));
  });

  it('replaces the URL only after a changed refresh succeeds', async () => {
    const refreshed = [
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
    ];
    vi.mocked(getCurrentConfigSnapshotsByInstances).mockResolvedValue(resolverResponse(refreshed));
    renderPage();
    await screen.findByText('Current snapshots across instances');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh current snapshots' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Refresh current snapshots' }));
    await waitFor(() => expect(getCurrentConfigSnapshotsByInstances).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(refreshed.join(',')));
    expect(screen.getByTestId('location')).toHaveTextContent('source=current-instances');
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/app/config/configSnapshotCompare?snapshotIds=${snapshotIds.join(',')}&source=current-instances`]}>
      <Routes>
        <Route path="/app/config/configSnapshotCompare" element={<><Location /><ConfigSnapshotCompare /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

function Location() {
  const location = useLocation();
  return <span data-testid="location">{location.search}</span>;
}

function resolverResponse(ids: string[]) {
  return {
    resolvedAt: '2026-07-14T12:01:00Z',
    comparisonLimits: { maxProperties: 10_000, maxResponseBytes: 5_242_880 },
    snapshots: ids.map((snapshotId, index) => ({
      hostId: '00000000-0000-4000-8000-000000000099',
      instanceId: instanceIds[index],
      instanceName: `instance-${index + 1}`,
      serviceId: 'service-1',
      environment: index ? 'qa' : 'dev',
      snapshotId,
      snapshotTs: '2026-07-14T12:01:00Z',
      propertyCount: 5,
    })),
  };
}
