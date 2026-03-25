import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_ColumnFiltersState,
    type MRT_PaginationState,
    type MRT_SortingState,
    type MRT_Row,
} from 'material-react-table';
import { Box, IconButton, Tooltip, Typography, Button } from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import AddBoxIcon from '@mui/icons-material/AddBox';
import { useUserState } from '../../contexts/UserContext.tsx';
import { apiPost } from '../../api/apiPost.ts';
import fetchClient from '../../utils/fetchClient';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';

// --- Type Definitions ---
type ClientTokenApiResponse = {
    tokens: Array<ClientTokenType>;
    total: number;
};

type ClientTokenType = {
    hostId: string;
    clientId: string;
    tokenId: string;
    expirationTs?: string;
    lastUsedTs?: string;
    updateUser?: string;
    updateTs?: string;
};

interface UserState {
    host?: string;
}

// Helper Cell component for truncating long text with a tooltip
const TruncatedCell = <T extends MRT_RowData>({ cell }: { cell: MRT_Cell<T, unknown> }) => {
    const value = cell.getValue<string>() ?? '';
    return (
        <Tooltip title={value} placement="top-start">
            <Box component="span" sx={{ display: 'block', maxWidth: '200px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {value}
            </Box>
        </Tooltip>
    );
};

export default function ClientToken() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;
    const initialData = location.state?.data || {};

    // Data and fetching state
    const [data, setData] = useState<ClientTokenType[]>([]);
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);

    // Table state, pre-filtered by context if provided
    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() =>
        Object.entries(initialData)
            .map(([id, value]) => ({ id, value: value as string }))
            .filter(f => f.value)
            .concat([{ id: 'active', value: 'true' }])
    );
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<MRT_SortingState>([]);
    const [pagination, setPagination] = useState<MRT_PaginationState>({
        pageIndex: 0,
        pageSize: 25,
    });

    // useEffect for data fetching
    useEffect(() => {
        const fetchData = async () => {
            if (!host) return;
            if (!data.length) setIsLoading(true); else setIsRefetching(true);

            let activeStatus = true; // Default to true if not present
            const apiFilters: MRT_ColumnFiltersState = [];

            columnFilters.forEach(filter => {
                if (filter.id === 'active') {
                    activeStatus = filter.value === 'true' || filter.value === true;
                } else {
                    apiFilters.push(filter);
                }
            });

            const cmd = {
                host: 'lightapi.net', service: 'oauth', action: 'getClientToken', version: '0.1.0',
                data: {
                    hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
                    sorting: JSON.stringify(sorting ?? []),
                    filters: JSON.stringify(apiFilters ?? []),
                    globalFilter: globalFilter ?? '',
                    active: activeStatus,
                },
            };

            const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

            try {
                const json = await fetchClient(url);
                setData(json.tokens || []);
                setRowCount(json.total || 0);
            } catch (error) {
                setIsError(true); console.error(error);
            } finally {
                setIsError(false); setIsLoading(false); setIsRefetching(false);
            }
        };
        fetchData();
    }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

    // Delete (Revoke) handler with optimistic update
    const handleDelete = useCallback(async (row: MRT_Row<ClientTokenType>) => {
        if (!window.confirm(`Are you sure you want to revoke this client token for clientId: ${row.original.clientId}?`)) return;

        const originalData = [...data];
        setData(prev => prev.filter(token => token.tokenId !== row.original.tokenId));
        setRowCount(prev => prev - 1);

        const cmd = {
            host: 'lightapi.net', service: 'oauth', action: 'deleteClientToken', version: '0.1.0',
            data: { hostId: host, clientId: row.original.clientId, tokenId: row.original.tokenId },
        };

        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                alert('Failed to revoke token. Please try again.');
                setData(originalData);
                setRowCount(originalData.length);
            }
        } catch (e) {
            alert('Failed to revoke token due to a network error.');
            setData(originalData);
            setRowCount(originalData.length);
        }
    }, [data, host]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<ClientTokenType>[]>(
        () => [
            { accessorKey: 'clientId', header: 'Client ID', Cell: TruncatedCell, muiTableBodyCellProps: { sx: { maxWidth: '150px' } } },
            { accessorKey: 'tokenId', header: 'Token ID (JTI)', Cell: TruncatedCell, muiTableBodyCellProps: { sx: { maxWidth: '150px' } } },
            {
                accessorKey: 'expirationTs', header: 'Expiration',
                Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
            },
            {
                accessorKey: 'lastUsedTs', header: 'Last Used',
                Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
            },
            { accessorKey: 'updateUser', header: 'Update User' },
            {
                accessorKey: 'updateTs', header: 'Last Updated',
                Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
            },
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
        state: { isLoading, showAlertBanner: isError, showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter },
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        getRowId: (row) => row.tokenId,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: true,
        renderRowActions: ({ row }) => (
            <Tooltip title="Revoke Token">
                <IconButton color="error" onClick={() => handleDelete(row)}>
                    <DeleteForeverIcon />
                </IconButton>
            </Tooltip>
        ),
        renderTopToolbarCustomActions: () => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                    variant="contained"
                    startIcon={<AddBoxIcon />}
                    onClick={() => navigate('/app/form/createClientToken', { state: { data: initialData } })}
                >
                    Create Token
                </Button>
            </Box>
        ),
    });

    return <MaterialReactTable table={table} />;
}
