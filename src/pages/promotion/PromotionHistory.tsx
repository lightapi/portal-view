import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_ColumnFiltersState,
    type MRT_PaginationState,
    type MRT_SortingState,
} from 'material-react-table';
import { Box, Button, IconButton, Tooltip, Chip } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useUserState } from '../../contexts/UserContext';
import fetchClient from '../../utils/fetchClient';

// --- Type Definitions ---
type PromotionApiResponse = {
    promotions: Array<PromotionType>;
    total: number;
};

type PromotionType = {
    promotionId: string;
    sourceHostId: string;
    sourceHostName?: string;
    targetHostId: string;
    targetHostName?: string;
    entityType: string;
    promotionStatus: string;
    createdBy: string;
    updateUser: string;
    updateTs: string;
};

interface UserState {
    host?: string;
}

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
    Planned: 'info',
    DryRun: 'warning',
    Executed: 'success',
    Failed: 'error',
    RolledBack: 'default',
};

export default function PromotionHistory() {
    const navigate = useNavigate();
    const { host } = useUserState() as UserState;

    // Data and fetching state
    const [data, setData] = useState<PromotionType[]>([]);
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);

    // Table state
    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<MRT_SortingState>([]);
    const [pagination, setPagination] = useState<MRT_PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });

    // Data fetching logic
    const fetchData = useCallback(async () => {
        if (!host) return;
        if (!data.length) setIsLoading(true); else setIsRefetching(true);

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
        } catch (error) {
            setIsError(true);
            console.error(error);
        } finally {
            setIsError(false);
            setIsLoading(false);
            setIsRefetching(false);
        }
    }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, data.length]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
    const table = useMaterialReactTable({
        columns,
        data,
        initialState: { showColumnFilters: true, density: 'compact' },
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        rowCount,
        state: {
            isLoading,
            showAlertBanner: isError,
            showProgressBars: isRefetching,
            pagination,
            sorting,
            columnFilters,
            globalFilter,
        },
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        getRowId: (row) => row.promotionId,
        muiToolbarAlertBannerProps: isError
            ? { color: 'error', children: 'Error loading data' }
            : undefined,
        enableRowActions: true,
        positionActionsColumn: 'first',
        renderRowActions: ({ row }) => (
            <Box sx={{ display: 'flex', gap: '0.1rem' }}>
                <Tooltip title="View Diff Details">
                    <IconButton
                        onClick={() =>
                            navigate('/app/promotion/diff', {
                                state: { data: row.original },
                            })
                        }
                    >
                        <VisibilityIcon />
                    </IconButton>
                </Tooltip>
            </Box>
        ),
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
            </Box>
        ),
    });

    return <MaterialReactTable table={table} />;
}
