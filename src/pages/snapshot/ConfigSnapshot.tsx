import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_ColumnFiltersState,
    type MRT_PaginationState,
    type MRT_SortingState,
    type MRT_Row,
    type MRT_RowSelectionState,
} from 'material-react-table';
import { Alert, Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import YardIcon from "@mui/icons-material/Yard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import InstallMobileIcon from "@mui/icons-material/InstallMobile";
import AppsIcon from "@mui/icons-material/Apps";
import ApiIcon from "@mui/icons-material/Api";
import FormatIndentIncreaseIcon from '@mui/icons-material/FormatIndentIncrease';
import TuneIcon from '@mui/icons-material/Tune';
import DescriptionIcon from '@mui/icons-material/Description';
import DataObjectIcon from '@mui/icons-material/DataObject';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import HistoryIcon from '@mui/icons-material/History';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromObject, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';
import SnapshotValuesDialog from './SnapshotValuesDialog';
import type { ConfigSnapshotListResponse, ConfigSnapshotSummary, SnapshotComparisonLimits } from './configSnapshotValues.types';
import {
    comparisonSelectionIssue,
    MAX_COMPARE_SNAPSHOTS,
    selectedPropertyCount,
    showSnapshotHistory,
    snapshotSelectionKey,
    updateSelectedSnapshots,
} from './snapshotSelection';

type ConfigSnapshotType = ConfigSnapshotSummary;

interface UserState {
    host?: string;
}

export default function ConfigSnapshot() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { host } = useUserState() as UserState;
    const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
    const initialInstanceId = location.state?.data?.instanceId || searchContext.instanceId;
    const taskContext = useMemo(
        () => mergeTaskContext(searchContext, { hostId: host ?? '', instanceId: initialInstanceId ?? '' }),
        [host, initialInstanceId, searchContext],
    );
    const contextForRow = useCallback(
        (row: ConfigSnapshotType) => mergeTaskContext(taskContext, contextFromObject(row)),
        [taskContext],
    );

    // Data and fetching state
    const [data, setData] = useState<ConfigSnapshotType[]>([]);
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);
    const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);
    const [valuesSnapshot, setValuesSnapshot] = useState<ConfigSnapshotType | null>(null);
    const [selectedSnapshots, setSelectedSnapshots] = useState<Map<string, ConfigSnapshotType>>(new Map());
    const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
    const [comparisonLimits, setComparisonLimits] = useState<SnapshotComparisonLimits>({
        maxProperties: Number.MAX_SAFE_INTEGER,
        maxResponseBytes: Number.MAX_SAFE_INTEGER,
    });
    const hasLoadedData = useRef(false);

    // Table state, pre-filtered by instanceId if provided
    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() => {
        const initialFilters: MRT_ColumnFiltersState = [];
        if (initialInstanceId) initialFilters.push({ id: 'instanceId', value: initialInstanceId });
        initialFilters.push({ id: 'current', value: 'true' });
        return initialFilters;
    });

    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<MRT_SortingState>([]);
    const [pagination, setPagination] = useState<MRT_PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });

    // Data fetching logic
    const fetchData = useCallback(async () => {
        if (!host) return;
        setIsError(false);
        if (!hasLoadedData.current) setIsLoading(true); else setIsRefetching(true);

        const apiFilters: MRT_ColumnFiltersState = [];

        columnFilters.forEach(filter => {
            if (filter.id === 'current') {
                // Handle boolean conversion for specific columns
                apiFilters.push({ ...filter, value: filter.value === 'true' });
            } else {
                // Keep other filters as is
                apiFilters.push(filter);
            }
        });

        const cmd = {
            host: 'lightapi.net', service: 'config', action: 'getConfigSnapshot', version: '0.1.0',
            data: {
                hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
                sorting: JSON.stringify(sorting ?? []),
                filters: JSON.stringify(apiFilters ?? []),
                globalFilter: globalFilter ?? '',
            },
        };

        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const json = await fetchClient(url) as ConfigSnapshotListResponse;
            setData(json.snapshots || []);
            hasLoadedData.current = true;
            setRowCount(json.total || 0);
            if (json.comparisonLimits?.maxProperties > 0 && json.comparisonLimits?.maxResponseBytes > 0) {
                setComparisonLimits(json.comparisonLimits);
            }
        } catch (error) {
            setIsError(true); console.error(error);
        } finally {
            setIsLoading(false); setIsRefetching(false);
        }
    }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

    // useEffect to trigger fetchData
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        hasLoadedData.current = false;
        setSelectedSnapshots(new Map());
        setSelectionMessage(null);
    }, [host]);

    const selectedRows = useMemo(() => Array.from(selectedSnapshots.values()), [selectedSnapshots]);
    const selectedCount = selectedRows.length;
    const selectedProperties = useMemo(() => selectedPropertyCount(selectedRows), [selectedRows]);
    const compareIssue = useMemo(
        () => comparisonSelectionIssue(selectedRows, comparisonLimits),
        [comparisonLimits, selectedRows],
    );
    const rowSelection = useMemo<MRT_RowSelectionState>(
        () => Object.fromEntries(Array.from(selectedSnapshots.keys()).map(key => [key, true])),
        [selectedSnapshots],
    );

    const handleRowSelectionChange = useCallback((
        updater: MRT_RowSelectionState | ((old: MRT_RowSelectionState) => MRT_RowSelectionState),
    ) => {
        setSelectedSnapshots(current => {
            const currentSelection = Object.fromEntries(Array.from(current.keys()).map(key => [key, true]));
            const nextSelection = typeof updater === 'function' ? updater(currentSelection) : updater;
            const { selected: next, capped } = updateSelectedSnapshots(current, data, nextSelection);
            setSelectionMessage(capped ? 'You can compare at most four snapshots.' : null);
            return next;
        });
    }, [data]);

    const compareSelected = () => {
        if (compareIssue) return;
        navigate(`/app/config/configSnapshotCompare?snapshotIds=${selectedRows.map(row => row.snapshotId).join(',')}`);
    };

    const showHistory = () => {
        setColumnFilters(filters => showSnapshotHistory(filters));
        setPagination(current => ({ ...current, pageIndex: 0 }));
    };

    // Delete handler with optimistic update
    const handleDelete = useCallback(async (row: MRT_Row<ConfigSnapshotType>) => {
        if (!window.confirm(`Are you sure you want to delete this snapshot from the instance?`)) return;

        const originalData = [...data];
        setData(prev => prev.filter(item => !(
            item.instanceId === row.original.instanceId
        )));
        setRowCount(prev => prev - 1);

        const cmd = {
            host: 'lightapi.net', service: 'config', action: 'deleteSnapshot', version: '0.1.0',
            data: row.original,
        };

        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                alert('Failed to delete snapshot. Please try again.');
                setData(originalData);
                setRowCount(originalData.length);
            }
        } catch (e) {
            alert('Failed to delete snapshot due to a network error.');
            setData(originalData);
            setRowCount(originalData.length);
        }
    }, [data]);

    const handleUpdate = useCallback(async (row: MRT_Row<ConfigSnapshotType>) => {
        const snapshotId = row.original.snapshotId;
        setIsUpdateLoading(snapshotId);

        const cmd = {
            host: 'lightapi.net', service: 'config', action: 'getFreshConfigSnapshot', version: '0.1.0',
      data: { hostId: row.original.hostId, snapshotId: row.original.snapshotId },
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const freshData = await fetchClient(url);
            console.log("freshData", freshData);
      const dataForForm = freshData.aggregateVersion === row.original.aggregateVersion ? row.original : freshData;

            // Navigate with the fresh data
            navigate(buildTaskAwareRoute('/app/form/updateConfigSnapshot', searchParams, contextForRow(row.original)), {
                state: {
                    data: dataForForm,
                    source: location.pathname
                }
            });
        } catch (error) {
            console.error("Failed to fetch config snapshot for update:", error);
            alert("Could not load the latest config snapshot data. Please try again.");
        } finally {
            setIsUpdateLoading(null);
        }
    }, [contextForRow, navigate, location.pathname, searchParams]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<ConfigSnapshotType>[]>(
        () => [
            { accessorKey: 'snapshotTs', header: 'Snapshot Ts' },
            { accessorKey: 'snapshotType', header: 'Snapshot Type' },
            { accessorKey: 'instanceName', header: 'Instance Name' },
            {
                accessorKey: 'current',
                header: 'Current',
                filterVariant: 'select',
                filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
            },
            { accessorKey: 'description', header: 'Description' },
            { accessorKey: 'userId', header: 'User Id' },
            { accessorKey: 'productId', header: 'Product Id' },
            { accessorKey: 'productVersion', header: 'Product Version' },
            { accessorKey: 'environment', header: 'Environment' },
            { accessorKey: 'serviceId', header: 'Service Id' },
            { accessorKey: 'apiId', header: 'Api Id' },
            { accessorKey: 'apiVersion', header: 'Api Version' },
            { accessorKey: 'snapshotId', header: 'Snapshot Id' },
            { accessorKey: 'hostId', header: 'Host Id' },
            { accessorKey: 'instanceId', header: 'Instance Id' },
            { accessorKey: 'deploymentId', header: 'Deployment Id' },
        ],
        [],
    );

    // Table instance configuration
    const table = useMaterialReactTable({
        columns,
        data,
        initialState: { showColumnFilters: true, density: 'compact' },
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        rowCount,
        state: { isLoading, showAlertBanner: isError, showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter, rowSelection },
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        getRowId: snapshotSelectionKey,
        enableRowSelection: row => selectedSnapshots.has(snapshotSelectionKey(row.original)) || selectedCount < MAX_COMPARE_SNAPSHOTS,
        onRowSelectionChange: handleRowSelectionChange,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: true,
        positionActionsColumn: 'first',
        displayColumnDefOptions: {
            'mrt-row-actions': {
                header: 'Actions',
                size: 500,
            },
        },
        renderRowActions: ({ row }) => (
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'nowrap',
                    gap: 0.5,
                }}
            >
                <Tooltip title="Update Snapshot">
                    <IconButton
                        onClick={() => handleUpdate(row)}
                        disabled={isUpdateLoading === row.original.snapshotId}
                    >
                        <SystemUpdateIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Delete Snapshot">
                    <IconButton color="error" onClick={() => handleDelete(row)}>
                        <DeleteForeverIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Snapshot Properties">
                    <IconButton onClick={() => navigate(
                        buildTaskAwareRoute('/app/config/configSnapshotProperty', searchParams, contextForRow(row.original)),
                        { state: { data: row.original } },
                    )}>
                        <FormatListBulletedIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="View canonical values.yml">
                    <IconButton
                        aria-label={`View values.yml for ${row.original.instanceName}`}
                        onClick={() => setValuesSnapshot(row.original)}
                    >
                        <DataObjectIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Snapshot Files">
                    <IconButton onClick={() => navigate(
                        buildTaskAwareRoute('/app/config/configSnapshotFile', searchParams, contextForRow(row.original)),
                        { state: { data: row.original } },
                    )}>
                        <DescriptionIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Deployment Props">
                    <IconButton onClick={() => navigate(
                        buildTaskAwareRoute('/app/config/configSnapshotDeploymentInstanceProperty', searchParams, contextForRow(row.original)),
                        { state: { data: row.original } },
                    )}>
                        <InstallMobileIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="API Props">
                    <IconButton onClick={() => navigate(
                        buildTaskAwareRoute('/app/config/configSnapshotInstanceApiProperty', searchParams, contextForRow(row.original)),
                        { state: { data: row.original } },
                    )}>
                        <ApiIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="App Props">
                    <IconButton onClick={() => navigate(
                        buildTaskAwareRoute('/app/config/configSnapshotInstanceAppProperty', searchParams, contextForRow(row.original)),
                        { state: { data: row.original } },
                    )}>
                        <AppsIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="App API Props">
                    <IconButton onClick={() => navigate(
                        buildTaskAwareRoute('/app/config/configSnapshotInstanceAppApiProperty', searchParams, contextForRow(row.original)),
                        { state: { data: row.original } },
                    )}>
                        <FormatIndentIncreaseIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Inst Props">
                    <IconButton onClick={() => navigate(
                        buildTaskAwareRoute('/app/config/configSnapshotInstanceProperty', searchParams, contextForRow(row.original)),
                        { state: { data: row.original } },
                    )}>
                        <TuneIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Env Props">
                    <IconButton onClick={() => navigate(
                        buildTaskAwareRoute('/app/config/configSnapshotEnvironmentProperty', searchParams, contextForRow(row.original)),
                        { state: { data: row.original } },
                    )}>
                        <YardIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Prd Props">
                    <IconButton onClick={() => navigate(
                        buildTaskAwareRoute('/app/config/configSnapshotProductProperty', searchParams, contextForRow(row.original)),
                        { state: { data: row.original } },
                    )}>
                        <Inventory2Icon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="PV Props">
                    <IconButton onClick={() => navigate(
                        buildTaskAwareRoute('/app/config/configSnapshotProductVersionProperty', searchParams, contextForRow(row.original)),
                        { state: { data: row.original } },
                    )}>
                        <AddToDriveIcon />
                    </IconButton>
                </Tooltip>
            </Box>
        ),
        renderTopToolbarCustomActions: () => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Button
                    variant="contained"
                    startIcon={<AddBoxIcon />}
                    onClick={() => navigate(
                        buildTaskAwareRoute('/app/form/createConfigSnapshot', searchParams, taskContext),
                        { state: { data: { instanceId: initialInstanceId } } },
                    )}
                    disabled={!initialInstanceId}
                >
                    Create Config Snapshot
                </Button>
                <Tooltip title={compareIssue ?? `Compare ${selectedCount} snapshots (${selectedProperties.toLocaleString()} properties)`}>
                    <span>
                        <Button
                            variant="outlined"
                            startIcon={<CompareArrowsIcon />}
                            disabled={Boolean(compareIssue)}
                            onClick={compareSelected}
                        >
                            Compare selected ({selectedCount})
                        </Button>
                    </span>
                </Tooltip>
                <Button startIcon={<HistoryIcon />} onClick={showHistory}>Show snapshot history</Button>
                {selectedCount > 0 && (
                    <Button onClick={() => { setSelectedSnapshots(new Map()); setSelectionMessage(null); }}>Clear selection</Button>
                )}
                {selectedRows.map(snapshot => (
                    <Chip key={snapshotSelectionKey(snapshot)} size="small" label={`${snapshot.instanceName}: ${snapshot.snapshotTs}`} />
                ))}
                {initialInstanceId && (
                    <Typography variant="subtitle1">
                        For Instance: <strong>{initialInstanceId}</strong>
                    </Typography>
                )}
            </Box>
        ),
    });

    return (
        <Box sx={{ p: 1 }}>
            <Box sx={{ mb: 2 }}>
                <TaskActionPanel
                    title="Config Snapshot Tasks"
                    context={taskContext}
                    taskIds={['capture-config-snapshot', 'manage-instance', 'manage-configuration']}
                    maxActions={3}
                />
            </Box>
            {selectionMessage && <Alert severity="warning" sx={{ mb: 1 }}>{selectionMessage}</Alert>}
            {selectedCount >= 2 && compareIssue && <Alert severity="warning" sx={{ mb: 1 }}>{compareIssue}</Alert>}
            <MaterialReactTable table={table} />
            <SnapshotValuesDialog hostId={host} snapshot={valuesSnapshot} onClose={() => setValuesSnapshot(null)} />
        </Box>
    );
}
