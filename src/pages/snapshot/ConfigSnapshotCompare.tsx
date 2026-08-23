import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
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
import RefreshIcon from '@mui/icons-material/Refresh';
import { useUserState } from '../../contexts/UserContext';
import { getCurrentConfigSnapshotsByInstances } from '../instance/instanceCurrentSnapshotsApi';
import { getConfigSnapshotValues } from './configSnapshotValuesApi';
import type { SnapshotValues } from './configSnapshotValues.types';
import {
  reorderSnapshotIds,
  type SnapshotComparisonDetailCell,
  type SnapshotComparisonDetailRow,
  type SnapshotComparisonModel,
  type SnapshotComparisonRow,
  type SnapshotComparisonStatus,
} from './snapshotComparison';
import { createSnapshotComparisonWorkerClient } from './snapshotComparisonWorkerClient';
import {
  canShowYamlDiff,
  parseSnapshotComparisonSource,
  parseSnapshotIds,
  sameSnapshotIdSet,
} from './snapshotSelection';

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
  const source = parseSnapshotComparisonSource(searchParams.get('source'));
  const isCurrentInstancesSource = source === 'current-instances';
  const [snapshots, setSnapshots] = useState<SnapshotValues[]>([]);
  const [model, setModel] = useState<SnapshotComparisonModel | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<SnapshotComparisonStatus[]>(['valueChanged', 'missing']);
  const [keySearch, setKeySearch] = useState('');
  const [detailKeySearch, setDetailKeySearch] = useState('');
  const [detailParentKey, setDetailParentKey] = useState<string | null>(null);
  const [tab, setTab] = useState<'matrix' | 'detail' | 'yaml'>('matrix');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const refreshController = useRef<AbortController | null>(null);
  const refreshGeneration = useRef(0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setSnapshots([]);
    setModel(null);
    setError(null);
    setRefreshError(null);
    setRefreshMessage(null);
    setTab('matrix');
    setDetailKeySearch('');
    setDetailParentKey(null);
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

  useEffect(() => {
    refreshGeneration.current += 1;
    refreshController.current?.abort();
    refreshController.current = null;
    setRefreshing(false);
  }, [host, snapshotIdsParam]);

  useEffect(() => () => {
    refreshGeneration.current += 1;
    refreshController.current?.abort();
  }, []);

  const snapshotsById = useMemo(() => new Map(snapshots.map(snapshot => [snapshot.snapshotId, snapshot])), [snapshots]);
  const filteredRows = useMemo(() => {
    if (!model) return [];
    const normalizedSearch = keySearch.trim().toLowerCase();
    return model.rows.filter(row => statuses.includes(row.status)
      && (!normalizedSearch || row.key.toLowerCase().includes(normalizedSearch)));
  }, [keySearch, model, statuses]);

  const filteredDetailRows = useMemo(() => {
    if (!model) return [];
    const normalizedSearch = detailKeySearch.trim().toLowerCase();
    return model.detailRows.filter(row => statuses.includes(row.status)
      && (!detailParentKey || row.parentKey === detailParentKey)
      && (!normalizedSearch || row.key.toLowerCase().includes(normalizedSearch)));
  }, [detailKeySearch, detailParentKey, model, statuses]);

  const compareNestedKeys = useCallback((key: string) => {
    setDetailParentKey(key);
    setDetailKeySearch('');
    setTab('detail');
  }, []);

  const columns = useMemo<MRT_ColumnDef<SnapshotComparisonRow>[]>(() => [
    {
      accessorKey: 'key',
      header: 'Configuration key',
      size: 280,
      Cell: ({ row }) => (
        <Stack alignItems="flex-start" spacing={0.5}>
          <Typography sx={{ overflowWrap: 'anywhere' }}>{row.original.key}</Typography>
          {hasStructuredValue(row.original) && (
            <Button size="small" variant="text" onClick={() => compareNestedKeys(row.original.key)}>
              Compare nested keys
            </Button>
          )}
        </Stack>
      ),
    },
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
  ], [columnOrder, compareNestedKeys, snapshotsById]);

  const detailColumns = useMemo<MRT_ColumnDef<SnapshotComparisonDetailRow>[]>(() => [
    {
      accessorKey: 'key',
      header: 'Configuration path',
      size: 420,
      Cell: ({ cell }) => (
        <Box component="code" sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', fontSize: 12 }}>
          {cell.getValue<string>()}
        </Box>
      ),
    },
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
        size: 320,
        accessorFn: (row: SnapshotComparisonDetailRow) => row.cells[snapshotId],
        Cell: ({ row }: { row: { original: SnapshotComparisonDetailRow } }) => renderDetailCell(row.original.cells[snapshotId]),
      } satisfies MRT_ColumnDef<SnapshotComparisonDetailRow>;
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

  const detailTable = useMaterialReactTable({
    columns: detailColumns,
    data: filteredDetailRows,
    enableColumnPinning: true,
    enableGlobalFilter: false,
    enableColumnFilters: false,
    initialState: {
      density: 'compact',
      pagination: { pageIndex: 0, pageSize: 50 },
      columnPinning: { left: ['key', 'status'] },
    },
    muiTableContainerProps: { sx: { maxHeight: '65vh' } },
  });

  const crossInstance = new Set(snapshots.map(snapshot => snapshot.instanceId)).size > 1;
  const containsNonCurrentSnapshot = isCurrentInstancesSource && snapshots.some(snapshot => !snapshot.current);
  const moveColumn = (snapshotId: string, direction: -1 | 1) => {
    setColumnOrder(current => reorderSnapshotIds(current, snapshotId, direction));
  };

  const refreshCurrentSnapshots = useCallback(async () => {
    if (!host || !snapshotIds || refreshing || !model) return;
    const instanceIds = columnOrder.map(snapshotId => snapshotsById.get(snapshotId)?.instanceId ?? '');
    if (instanceIds.some(instanceId => !instanceId) || new Set(instanceIds).size !== instanceIds.length) {
      setRefreshError('The loaded snapshot metadata cannot be used to refresh this comparison.');
      return;
    }
    refreshController.current?.abort();
    const controller = new AbortController();
    const generation = ++refreshGeneration.current;
    refreshController.current = controller;
    setRefreshError(null);
    setRefreshMessage(null);
    setRefreshing(true);
    try {
      const response = await getCurrentConfigSnapshotsByInstances({ hostId: host, instanceIds, signal: controller.signal });
      if (controller.signal.aborted || generation !== refreshGeneration.current) return;
      const resolvedIds = response.snapshots.map(snapshot => snapshot.snapshotId);
      if (sameSnapshotIdSet(snapshotIds, resolvedIds)) {
        setRefreshMessage('This comparison already contains the current snapshots.');
        return;
      }
      navigate(`/app/config/configSnapshotCompare?snapshotIds=${resolvedIds.join(',')}&source=current-instances`, { replace: true });
    } catch (caught: unknown) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      if (generation === refreshGeneration.current) {
        setRefreshError(caught instanceof Error ? caught.message : 'Unable to refresh current configuration snapshots.');
      }
    } finally {
      if (generation === refreshGeneration.current) {
        refreshController.current = null;
        setRefreshing(false);
      }
    }
  }, [columnOrder, host, model, navigate, refreshing, snapshotIds, snapshotsById]);

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton
            aria-label={isCurrentInstancesSource ? 'Back to instances' : 'Back to snapshots'}
            onClick={() => navigate(isCurrentInstancesSource ? '/app/instance/InstanceAdmin' : '/app/config/configSnapshot')}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">
            {isCurrentInstancesSource ? 'Current snapshots across instances' : 'Config snapshot comparison'}
          </Typography>
          {isCurrentInstancesSource && (
            <Button
              variant="outlined"
              startIcon={refreshing ? <CircularProgress size={18} /> : <RefreshIcon />}
              disabled={refreshing || !model}
              onClick={refreshCurrentSnapshots}
            >
              {refreshing ? 'Refreshing…' : 'Refresh current snapshots'}
            </Button>
          )}
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {refreshError && <Alert severity="error">{refreshError} The existing comparison has not changed.</Alert>}
        {refreshMessage && <Alert severity="success">{refreshMessage}</Alert>}
        {containsNonCurrentSnapshot && (
          <Alert severity="warning">
            At least one resolved snapshot is no longer current. This page continues to show the exact snapshots identified in the URL; refresh explicitly to resolve newer snapshots.
          </Alert>
        )}
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
                      <Chip
                        size="small"
                        sx={{ mt: 1 }}
                        color={snapshot.current ? 'success' : 'warning'}
                        label={snapshot.current ? 'Current' : 'No longer current'}
                      />
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
            <Tabs value={tab} onChange={(_, value: 'matrix' | 'detail' | 'yaml') => setTab(value)}>
              <Tab value="matrix" label="Semantic matrix" />
              <Tab value="detail" label="Key-by-key diff" />
              {canShowYamlDiff(columnOrder.length) && <Tab value="yaml" label="YAML text diff" />}
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
            {tab === 'detail' && (
              <Stack spacing={1}>
                {detailParentKey && (
                  <Alert
                    severity="info"
                    action={<Button color="inherit" size="small" onClick={() => setDetailParentKey(null)}>Show all keys</Button>}
                  >
                    Comparing nested keys under <Box component="code">{detailParentKey}</Box>.
                  </Alert>
                )}
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <Button size="small" variant="outlined" onClick={() => setStatuses(ALL_STATUSES)}>All</Button>
                  <ToggleButtonGroup
                    value={statuses}
                    onChange={(_, next: SnapshotComparisonStatus[]) => setStatuses(next.length ? next : ALL_STATUSES)}
                    size="small"
                    aria-label="Key-by-key comparison status filters"
                  >
                    {ALL_STATUSES.map(status => <ToggleButton key={status} value={status}>{STATUS_LABELS[status]}</ToggleButton>)}
                  </ToggleButtonGroup>
                  <TextField
                    size="small"
                    label="Search configuration paths"
                    value={detailKeySearch}
                    onChange={event => setDetailKeySearch(event.target.value)}
                  />
                </Stack>
                <MaterialReactTable table={detailTable} />
              </Stack>
            )}
            {tab === 'yaml' && canShowYamlDiff(columnOrder.length) && host && (
              <Stack spacing={1}>
                <Alert severity="info">
                  This view compares the exact canonical YAML text. Use Key-by-key diff for maps and lists with different row counts.
                </Alert>
                <Suspense fallback={<CircularProgress size={22} />}>
                  <SnapshotYamlDiff hostId={host} snapshotIds={columnOrder as [string, string]} />
                </Suspense>
              </Stack>
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
        <Typography>{structuredValueSummary(entry.value)}</Typography>
      ) : (
        <Typography sx={{ overflowWrap: 'anywhere' }}>{String(entry.value)}</Typography>
      )}
      <Typography variant="caption" color="text.secondary">{entry.valueType} · {entry.sourceLevel}</Typography>
    </Box>
  );
}

function renderDetailCell(entry: SnapshotComparisonDetailCell | null) {
  if (!entry) return <Typography color="text.secondary">Missing</Typography>;
  const value = entry.valueType === 'map' || entry.valueType === 'list'
    ? JSON.stringify(entry.value)
    : String(entry.value);
  return (
    <Box>
      <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{entry.valueType} · {entry.sourceLevel}</Typography>
    </Box>
  );
}

function hasStructuredValue(row: SnapshotComparisonRow) {
  return Object.values(row.cells).some(entry => entry?.value !== null && typeof entry?.value === 'object');
}

function structuredValueSummary(value: unknown) {
  if (Array.isArray(value)) return `List (${value.length} items)`;
  return value !== null && typeof value === 'object' ? `Map (${Object.keys(value).length} keys)` : String(value);
}
