import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_ColumnFiltersState,
    type MRT_PaginationState,
    type MRT_Row,
    type MRT_SortingState,
} from 'material-react-table';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControlLabel,
    IconButton,
    Stack,
    Switch,
    Tooltip,
} from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useUserState } from '../../contexts/UserContext';
import { buildGenAiTaskContext, buildGenAiTaskRoute, GenAiTaskLayout } from './genAiTaskUtils';
import {
    hindsightErrorMessage,
    optimisticRemove,
    runHindsightCommand,
    runHindsightQuery,
    type HindsightRow,
} from './hindsightMemoryApi';

type MemoryBank = HindsightRow & {
    bankId: string;
    bankName: string;
    agentDefId?: string;
    agentDefinitionName?: string;
    userId?: string;
    userEmail?: string;
    disposition?: Record<string, number>;
    background?: string;
    runtimeManaged: boolean;
    active: boolean;
    updateTs?: string;
};

type UserState = { host?: string };

export default function MemoryBanks() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const baseContext = useMemo(() => buildGenAiTaskContext(host, searchParams), [host, searchParams]);
    const loaded = useRef(false);
    const [rows, setRows] = useState<MemoryBank[]>([]);
    const [rowCount, setRowCount] = useState(0);
    const [includeRuntimeManaged, setIncludeRuntimeManaged] = useState(false);
    const [pagination, setPagination] = useState<MRT_PaginationState>({ pageIndex: 0, pageSize: 25 });
    const [sorting, setSorting] = useState<MRT_SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([{ id: 'active', value: 'true' }]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [loading, setLoading] = useState(false);
    const [refetching, setRefetching] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    const fetchBanks = useCallback(async () => {
        if (!host) return;
        loaded.current ? setRefetching(true) : setLoading(true);
        setMessage('');
        let active = true;
        const filters: Array<{ id: string; value: unknown }> = [];
        columnFilters.forEach(filter => {
            if (filter.id === 'active') active = filter.value === true || filter.value === 'true';
            else filters.push({ id: filter.id, value: filter.value });
        });
        try {
            const response = await runHindsightQuery<Record<string, any>>('getAgentMemoryBanks', {
                hostId: host,
                offset: pagination.pageIndex * pagination.pageSize,
                limit: pagination.pageSize,
                filters,
                globalFilter: globalFilter || '',
                sorting,
                active,
                includeRuntimeManaged,
            });
            setRows(Array.isArray(response.agentMemoryBanks) ? response.agentMemoryBanks : []);
            setRowCount(Number(response.total ?? 0));
            loaded.current = true;
        } catch (error) {
            setMessage(hindsightErrorMessage(error));
        } finally {
            setLoading(false);
            setRefetching(false);
        }
    }, [columnFilters, globalFilter, host, includeRuntimeManaged, pagination.pageIndex, pagination.pageSize, sorting]);

    useEffect(() => { void fetchBanks(); }, [fetchBanks]);

    const rowContext = useCallback((row: MemoryBank) => ({ ...baseContext, bankId: row.bankId }), [baseContext]);
    const openWorkspace = useCallback((row: MemoryBank) => {
        navigate(buildGenAiTaskRoute(`/app/genai/MemoryBanks/${row.bankId}`, searchParams, rowContext(row)), {
            state: { data: row, source: location.pathname + location.search },
        });
    }, [location.pathname, location.search, navigate, rowContext, searchParams]);

    const createBank = useCallback(() => {
        navigate(buildGenAiTaskRoute('/app/form/createAgentMemoryBank', searchParams, baseContext), {
            state: {
                data: {
                    hostId: host,
                    disposition: { skepticism: 3, literalism: 3, empathy: 3 },
                },
                source: location.pathname + location.search,
            },
        });
    }, [baseContext, host, location.pathname, location.search, navigate, searchParams]);

    const updateBank = useCallback(async (row: MemoryBank) => {
        setBusyId(row.bankId);
        setMessage('');
        try {
            const fresh = await runHindsightQuery<MemoryBank>('getFreshAgentMemoryBank', {
                hostId: row.hostId,
                bankId: row.bankId,
                aggregateVersion: row.aggregateVersion,
            });
            navigate(buildGenAiTaskRoute('/app/form/updateAgentMemoryBank', searchParams, rowContext(row)), {
                state: {
                    data: {
                        hostId: fresh.hostId, bankId: fresh.bankId, agentDefId: fresh.agentDefId,
                        userId: fresh.userId, bankName: fresh.bankName, disposition: fresh.disposition,
                        background: fresh.background, aggregateVersion: fresh.aggregateVersion,
                    },
                    source: location.pathname + location.search,
                },
            });
        } catch (error) {
            setMessage(hindsightErrorMessage(error));
        } finally {
            setBusyId(null);
        }
    }, [location.pathname, location.search, navigate, rowContext, searchParams]);

    const deleteBank = useCallback(async (row: MemoryBank) => {
        if (!window.confirm(`Deactivate memory bank ${row.bankName}?`)) return;
        const optimistic = optimisticRemove(rows, rowCount, item => item.bankId === row.bankId);
        setRows(optimistic.nextRows);
        setRowCount(optimistic.nextRowCount);
        setBusyId(row.bankId);
        setMessage('');
        try {
            await runHindsightCommand('deleteAgentMemoryBank', {
                hostId: row.hostId,
                bankId: row.bankId,
                aggregateVersion: row.aggregateVersion,
            });
        } catch (error) {
            setRows(optimistic.rollback.rows);
            setRowCount(optimistic.rollback.rowCount);
            setMessage(hindsightErrorMessage(error));
        } finally {
            setBusyId(null);
        }
    }, [rowCount, rows]);

    const columns = useMemo<MRT_ColumnDef<MemoryBank>[]>(() => [
        {
            accessorKey: 'bankName',
            header: 'Bank',
            Cell: ({ row }) => (
                <Stack direction="row" spacing={1} alignItems="center">
                    <Button color="inherit" onClick={() => openWorkspace(row.original)} sx={{ textTransform: 'none' }}>
                        {row.original.bankName}
                    </Button>
                    {row.original.runtimeManaged && <Chip size="small" label="Runtime managed" color="info" />}
                </Stack>
            ),
        },
        { accessorKey: 'agentDefinitionName', header: 'Agent Definition' },
        { accessorKey: 'userEmail', header: 'User' },
        { accessorKey: 'bankId', header: 'Bank Id' },
        { accessorKey: 'aggregateVersion', header: 'Version' },
        {
            accessorKey: 'updateTs',
            header: 'Updated',
            Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '—',
        },
        {
            accessorKey: 'active',
            header: 'Active',
            filterVariant: 'select',
            filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
            Cell: ({ cell }) => cell.getValue() ? 'True' : 'False',
        },
    ], [openWorkspace]);

    const table = useMaterialReactTable({
        columns,
        data: rows,
        initialState: { density: 'compact', showColumnFilters: true },
        manualFiltering: true,
        manualPagination: true,
        manualSorting: true,
        rowCount,
        getRowId: row => row.bankId,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        state: { columnFilters, globalFilter, isLoading: loading, pagination, showAlertBanner: !!message, showProgressBars: refetching, sorting },
        muiToolbarAlertBannerProps: message ? { color: 'error', children: message } : undefined,
        enableRowActions: true,
        positionActionsColumn: 'first',
        renderRowActions: ({ row }: { row: MRT_Row<MemoryBank> }) => (
            <Stack direction="row" spacing={0.5}>
                <Tooltip title="Open workspace"><IconButton onClick={() => openWorkspace(row.original)}><OpenInNewIcon /></IconButton></Tooltip>
                <Tooltip title={row.original.runtimeManaged ? 'Runtime-managed banks are read-only' : 'Update bank'}><span><IconButton aria-label="Update bank" onClick={() => void updateBank(row.original)} disabled={row.original.runtimeManaged || busyId === row.original.bankId}>{busyId === row.original.bankId ? <CircularProgress size={20} /> : <EditIcon />}</IconButton></span></Tooltip>
                <Tooltip title={row.original.runtimeManaged ? 'Runtime-managed banks are read-only' : 'Deactivate bank'}><span><IconButton aria-label="Deactivate bank" color="error" onClick={() => void deleteBank(row.original)} disabled={row.original.runtimeManaged || busyId === row.original.bankId}><DeleteForeverIcon /></IconButton></span></Tooltip>
            </Stack>
        ),
        renderTopToolbarCustomActions: () => (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Button variant="contained" startIcon={<AddBoxIcon />} onClick={createBank}>Create Memory Bank</Button>
                <FormControlLabel
                    control={<Switch checked={includeRuntimeManaged} onChange={(_, checked) => { setPagination(current => ({ ...current, pageIndex: 0 })); setIncludeRuntimeManaged(checked); }} />}
                    label="Include runtime-managed banks"
                />
            </Stack>
        ),
    });

    return (
        <GenAiTaskLayout context={baseContext}>
            <Box>
                <Alert severity="info" sx={{ mb: 1 }}>
                    Runtime-created session banks are excluded by default before pagination and counts. Enable the control to include them.
                </Alert>
                <MaterialReactTable table={table} />
            </Box>
        </GenAiTaskLayout>
    );
}
