import { PortalActions, PortalActionScope } from '../../components/PortalActions/PortalActions';
import { usePortalActionTableOptions } from '../../components/PortalActions/usePortalActionTableOptions';
import { usePersistentPagination, PAGE_SIZE_OPTIONS } from '../../hooks/usePersistentPagination';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_ColumnFiltersState,
    type MRT_SortingState,
} from 'material-react-table';
import { Alert, Box, Button, Chip } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useUserState } from '../../contexts/UserContext';
import fetchClient from '../../utils/fetchClient';
import { loadErrorMessage } from '../../utils/loadErrorMessage';
import { apiPost } from '../../api/apiPost';

// --- Type Definitions ---
type PromotionApiResponse = {
    promotions: Array<PromotionType>;
    total: number;
    alerts?: PromotionAlerts;
};

type PromotionAlerts = {
    pendingOverTwoMinutes: number;
    failuresLast15Minutes: number;
    failureRateLast15Minutes: number;
    releaseRollbackRecommended: boolean;
};

type PromotionType = {
    promotionId: string;
    sourceHostId: string;
    sourceHostName?: string;
    targetHostId: string;
    targetHostName?: string;
    entityType: string;
    promotionStatus: string;
    projectionStatus?: string;
    createdBy: string;
    updateUser: string;
    updateTs: string;
};

interface UserState {
    host?: string;
}

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
    PLANNED: 'info',
    BLOCKED: 'warning',
    APPEND_ACCEPTED: 'success',
    COMPLETED: 'success',
    TIMED_OUT: 'warning',
    FAILED: 'error',
};

export default function PromotionHistory() {
    const navigate = useNavigate();
    const { host } = useUserState() as UserState;

    // Data and fetching state
    const [data, setData] = useState<PromotionType[]>([]);
    const [isError, setIsError] = useState<string | false>(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);
    const [alerts, setAlerts] = useState<PromotionAlerts | null>(null);
    const hasLoaded = useRef(false);

    // Table state
    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<MRT_SortingState>([]);
    const [pagination, setPagination] = usePersistentPagination();

    // Data fetching logic
    const fetchData = useCallback(async () => {
        if (!host) return;
        setIsError(false);
        if (!hasLoaded.current) setIsLoading(true); else setIsRefetching(true);

        const cmd = {
            host: 'lightapi.net', service: 'user', action: 'getPromotionHistory', version: '0.1.0',
            data: {
                hostId: host,
                offset: pagination.pageIndex * pagination.pageSize,
                limit: pagination.pageSize,
                sorting: JSON.stringify(sorting ?? []),
                filters: JSON.stringify(columnFilters ?? []),
                globalFilter: globalFilter ?? '',
            },
        };

        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const json = await fetchClient(url) as PromotionApiResponse;
            setData(json.promotions || []);
            setRowCount(json.total || 0);
            setAlerts(json.alerts || null);
            hasLoaded.current = true;
            setIsError(false);
        } catch (error) {
            setIsError(loadErrorMessage(error));
            console.error(error);
        } finally {
            setIsLoading(false);
            setIsRefetching(false);
        }
    }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const hasPendingProjection = data.some((row) =>
        row.projectionStatus === 'PENDING' || row.promotionStatus === 'APPEND_ACCEPTED');
    const refreshProjectionStatus = useCallback(async () => {
        const pending = data.filter((row) =>
            row.projectionStatus === 'PENDING' || row.promotionStatus === 'APPEND_ACCEPTED');
        await Promise.all(pending.map((row) => apiPost({
            url: '/portal/command',
            headers: {},
            body: {
                host: 'lightapi.net', service: 'user', action: 'promotionRecovery', version: '0.1.0',
                data: { promotionId: row.promotionId, recoveryAction: 'RECHECK' },
            },
        })));
        await fetchData();
    }, [data, fetchData]);
    useEffect(() => {
        if (!hasPendingProjection) return;
        const timer = window.setInterval(refreshProjectionStatus, 5000);
        return () => window.clearInterval(timer);
    }, [hasPendingProjection, refreshProjectionStatus]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<PromotionType>[]>(
        () => [
            { accessorKey: 'sourceHostName', header: 'Source Host' },
            { accessorKey: 'targetHostName', header: 'Target Host' },
            { accessorKey: 'entityType', header: 'Entity Type' },
            {
                accessorKey: 'promotionStatus',
                header: 'Status',
                Cell: ({ cell }) => {
                    const status = cell.getValue<string>();
                    return (
                        <Chip
                            label={status}
                            color={statusColors[status] || 'default'}
                            size="small"
                        />
                    );
                },
            },
            {
                accessorKey: 'projectionStatus',
                header: 'Projection',
                Cell: ({ cell }) => {
                    const status = cell.getValue<string>() || 'NOT_STARTED';
                    return <Chip label={status} color={statusColors[status] || 'default'} size="small" />;
                },
            },
            { accessorKey: 'createdBy', header: 'Created By' },
            {
                accessorKey: 'updateTs',
                header: 'Timestamp',
                Cell: ({ cell }) => cell.getValue<string>()
                    ? new Date(cell.getValue<string>()).toLocaleString()
                    : '',
            },
            { accessorKey: 'promotionId', header: 'Promotion ID' },
        ],
        [],
    );

    // Table instance
    const table = useMaterialReactTable(usePortalActionTableOptions({
        columns,
        data,
        initialState: { showColumnFilters: true, density: 'compact' },
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        rowCount,
        state: {
            isLoading,
            showAlertBanner: Boolean(isError),
            showProgressBars: isRefetching,
            pagination,
            sorting,
            columnFilters,
            globalFilter,
        },
        onPaginationChange: setPagination,
        muiPaginationProps: { rowsPerPageOptions: PAGE_SIZE_OPTIONS },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        getRowId: (row) => row.promotionId,
        muiToolbarAlertBannerProps: isError
            ? { color: 'error', children: typeof isError === 'string' ? isError : 'Error loading data' }
            : undefined,
        enableRowActions: true,
        positionActionsColumn: 'first',
      renderRowActions: ({ row }) => <PortalActions row={row} actions={[
        {
          id: "view-diff-details",
          label: "View Diff Details",
          description: "Inspect the changes included in this promotion.",
          icon: <VisibilityIcon />,
          onSelect: () =>
            navigate('/app/promotion/diff', {
              state: { data: row.original },
            })
        }
      ]} />,
        renderTopToolbarCustomActions: () => (
            <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                    variant="contained"
                    onClick={() => navigate('/app/promotion/export')}
                >
                    New Export
                </Button>
                <Button
                    variant="outlined"
                    onClick={() => navigate('/app/promotion/import')}
                >
                    New Import
                </Button>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refreshProjectionStatus}>
                    Refresh Status
                </Button>
            </Box>
        ),
    }));

    return (
        <Box>
            {alerts && (alerts.pendingOverTwoMinutes > 0 || alerts.failuresLast15Minutes > 0) && (
                <Alert severity={alerts.releaseRollbackRecommended ? 'error' : 'warning'} sx={{ mb: 2 }}>
                    {alerts.pendingOverTwoMinutes} promotion(s) pending over two minutes;{' '}
                    {alerts.failuresLast15Minutes} failure(s) in 15 minutes
                    ({(alerts.failureRateLast15Minutes * 100).toFixed(1)}%).
                    {alerts.releaseRollbackRecommended && ' Release rollback threshold exceeded.'}
                </Alert>
            )}
        <PortalActionScope><MaterialReactTable table={table} /></PortalActionScope>
        </Box>
    );
}
