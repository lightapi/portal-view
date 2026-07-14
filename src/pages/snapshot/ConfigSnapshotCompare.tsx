import { lazy, Suspense, useEffect, useMemo, useState, useTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from 'material-react-table';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowLeftIcon from '@mui/icons-material/ArrowLeft';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import { useUserState } from '../../contexts/UserContext';
import { getConfigSnapshotValues } from './configSnapshotValuesApi';
import type { SnapshotValues } from './configSnapshotValues.types';
import {
  reorderSnapshotIds,
  type SnapshotComparisonModel,
  type SnapshotComparisonRow,
  type SnapshotComparisonStatus,
} from './snapshotComparison';
import { createSnapshotComparisonWorkerClient } from './snapshotComparisonWorkerClient';
import { canShowYamlDiff, parseSnapshotIds } from './snapshotSelection';

const SnapshotYamlDiff = lazy(() => import('./SnapshotYamlDiff'));
const ALL_STATUSES: SnapshotComparisonStatus[] = ['valueChanged', 'missing', 'sourceChanged', 'same'];
const STATUS_LABELS: Record<SnapshotComparisonStatus, string> = {
  same: 'Same',
  valueChanged: 'Changed',
  missing: 'Missing',
  sourceChanged: 'Source changed',
};

export default function ConfigSnapshotCompare() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { host } = useUserState();
  const snapshotIdsParam = searchParams.get('snapshotIds');
  const snapshotIds = useMemo(() => parseSnapshotIds(snapshotIdsParam), [snapshotIdsParam]);
  const [snapshots, setSnapshots] = useState<SnapshotValues[]>([]);
  const [model, setModel] = useState<SnapshotComparisonModel | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<SnapshotComparisonStatus[]>(['valueChanged', 'missing']);
  const [keySearch, setKeySearch] = useState('');
  const [tab, setTab] = useState<'matrix' | 'yaml'>('matrix');
  const [, startTransition] = useTransition();

  useEffect(() => {
    setSnapshots([]);
    setModel(null);
    setError(null);
    setTab('matrix');
    if (!snapshotIds || !host) {
      setError(!snapshotIds
        ? 'The comparison URL must contain two to four unique snapshot UUIDs.'
        : 'An authenticated host is required.');
      return;
    }
    const controller = new AbortController();
    const workerClient = createSnapshotComparisonWorkerClient();
    setLoading(true);
    getConfigSnapshotValues({ hostId: host, snapshotIds, include: ['entries'], signal: controller.signal })
      .then(async response => {
        if (new Set(response.snapshots.map(snapshot => snapshot.serviceId)).size > 1) {
          throw new Error('Selected snapshots must have the same service id.');
        }
        if (controller.signal.aborted) return;
        setSnapshots(response.snapshots);
        setLoading(false);
        setPreparing(true);
        const calculated = await workerClient.calculate(response.snapshots);
        if (controller.signal.aborted) return;
        startTransition(() => {
          setModel(calculated);
          setColumnOrder(calculated.snapshotIds);
          setBaseline(calculated.baselineSnapshotId);
          setPreparing(false);
        });
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setLoading(false);
          setPreparing(false);
          setError(caught instanceof Error ? caught.message : 'Unable to compare snapshots.');
        }
      });
    return () => {
      controller.abort();
      workerClient.dispose();
    };
  }, [host, snapshotIds]);

  const snapshotsById = useMemo(() => new Map(snapshots.map(snapshot => [snapshot.snapshotId, snapshot])), [snapshots]);
  const filteredRows = useMemo(() => {
    if (!model) return [];
    const normalizedSearch = keySearch.trim().toLowerCase();
    return model.rows.filter(row => statuses.includes(row.status)
      && (!normalizedSearch || row.key.toLowerCase().includes(normalizedSearch)));
  }, [keySearch, model, statuses]);

  const columns = useMemo<MRT_ColumnDef<SnapshotComparisonRow>[]>(() => [
    { accessorKey: 'key', header: 'Configuration key', size: 280 },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 130,
      Cell: ({ cell }) => <Chip size="small" label={STATUS_LABELS[cell.getValue<SnapshotComparisonStatus>()]} />,
    },
    ...columnOrder.map(snapshotId => {
      const snapshot = snapshotsById.get(snapshotId);
      return {
        id: snapshotId,
        header: snapshot ? `${snapshot.instanceName} · ${snapshot.snapshotTs}` : snapshotId,
        Header: () => (
          <Tooltip title={snapshot ? `${snapshot.snapshotId} · ${snapshot.serviceId} · ${snapshot.environment ?? 'No environment'}` : snapshotId}>
            <span>{snapshot ? `${snapshot.instanceName} · ${snapshot.snapshotTs}` : snapshotId}</span>
          </Tooltip>
        ),
        size: 300,
        accessorFn: (row: SnapshotComparisonRow) => row.cells[snapshotId],
        Cell: ({ row }: { row: { original: SnapshotComparisonRow } }) => renderCell(row.original.cells[snapshotId]),
      } satisfies MRT_ColumnDef<SnapshotComparisonRow>;
    }),
  ], [columnOrder, snapshotsById]);

  const table = useMaterialReactTable({
    columns,
    data: filteredRows,
    enableColumnPinning: true,
    enableGlobalFilter: false,
    enableColumnFilters: false,
    initialState: {
      density: 'compact',
      pagination: { pageIndex: 0, pageSize: 25 },
      columnPinning: { left: ['key', 'status'] },
    },
    muiTableContainerProps: { sx: { maxHeight: '65vh' } },
  });

  const crossInstance = new Set(snapshots.map(snapshot => snapshot.instanceId)).size > 1;
  const moveColumn = (snapshotId: string, direction: -1 | 1) => {
    setColumnOrder(current => reorderSnapshotIds(current, snapshotId, direction));
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton aria-label="Back to snapshots" onClick={() => navigate('/app/config/configSnapshot')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">Config snapshot comparison</Typography>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {crossInstance && <Alert severity="info">This comparison spans multiple instances or environments.</Alert>}
        {(loading || preparing) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={22} />
            <Typography>{preparing ? 'Preparing comparison…' : 'Loading complete snapshot entries…'}</Typography>
          </Box>
        )}
        {model && (
          <>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
              {columnOrder.map((snapshotId, index) => {
                const snapshot = snapshotsById.get(snapshotId);
                if (!snapshot) return null;
                return (
                  <Card key={snapshotId} variant="outlined" sx={{ flex: 1, borderColor: baseline === snapshotId ? 'primary.main' : undefined }}>
                    <CardContent>
                      <Typography variant="subtitle1">{snapshot.instanceName}</Typography>
                      <Typography variant="body2">{snapshot.snapshotTs}</Typography>
                      <Typography variant="caption" display="block">{snapshot.environment} · {snapshot.serviceId}</Typography>
                      <Typography variant="caption" display="block">{snapshot.propertyCount} properties · {snapshot.sha256}</Typography>
                      <Stack direction="row" spacing={0.5} mt={1}>
                        <Tooltip title="Move column left"><span><IconButton size="small" disabled={index === 0} onClick={() => moveColumn(snapshotId, -1)}><ArrowLeftIcon /></IconButton></span></Tooltip>
                        <Tooltip title="Move column right"><span><IconButton size="small" disabled={index === columnOrder.length - 1} onClick={() => moveColumn(snapshotId, 1)}><ArrowRightIcon /></IconButton></span></Tooltip>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
            <FormControl size="small" sx={{ maxWidth: 420 }}>
              <InputLabel id="baseline-label">Baseline</InputLabel>
              <Select labelId="baseline-label" label="Baseline" value={baseline} onChange={event => setBaseline(event.target.value)}>
                {columnOrder.map(snapshotId => {
                  const snapshot = snapshotsById.get(snapshotId);
                  return <MenuItem key={snapshotId} value={snapshotId}>{snapshot?.instanceName} · {snapshot?.snapshotTs}</MenuItem>;
                })}
              </Select>
            </FormControl>
            <Tabs value={tab} onChange={(_, value: 'matrix' | 'yaml') => setTab(value)}>
              <Tab value="matrix" label="Semantic matrix" />
              {canShowYamlDiff(columnOrder.length) && <Tab value="yaml" label="YAML diff" />}
            </Tabs>
            {tab === 'matrix' && (
              <Stack spacing={1}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <Button size="small" variant="outlined" onClick={() => setStatuses(ALL_STATUSES)}>All</Button>
                  <ToggleButtonGroup
                    value={statuses}
                    onChange={(_, next: SnapshotComparisonStatus[]) => setStatuses(next.length ? next : ALL_STATUSES)}
                    size="small"
                    aria-label="Comparison status filters"
                  >
                    {ALL_STATUSES.map(status => <ToggleButton key={status} value={status}>{STATUS_LABELS[status]}</ToggleButton>)}
                  </ToggleButtonGroup>
                  <TextField size="small" label="Search configuration keys" value={keySearch} onChange={event => setKeySearch(event.target.value)} />
                </Stack>
                <MaterialReactTable table={table} />
              </Stack>
            )}
            {tab === 'yaml' && canShowYamlDiff(columnOrder.length) && host && (
              <Suspense fallback={<CircularProgress size={22} />}>
                <SnapshotYamlDiff hostId={host} snapshotIds={columnOrder as [string, string]} />
              </Suspense>
            )}
          </>
        )}
      </Stack>
    </Box>
  );
}

function renderCell(entry: SnapshotComparisonRow['cells'][string]) {
  if (!entry) return <Typography color="text.secondary">Missing</Typography>;
  const structured = entry.value !== null && typeof entry.value === 'object';
  return (
    <Box>
      {structured ? (
        <details>
          <summary>{Array.isArray(entry.value) ? `List (${entry.value.length})` : 'Map'}</summary>
          <Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>
            {JSON.stringify(entry.value, null, 2)}
          </Box>
        </details>
      ) : (
        <Typography sx={{ overflowWrap: 'anywhere' }}>{String(entry.value)}</Typography>
      )}
      <Typography variant="caption" color="text.secondary">{entry.valueType} · {entry.sourceLevel}</Typography>
    </Box>
  );
}
