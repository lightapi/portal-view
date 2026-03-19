
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_ColumnFiltersState,
    type MRT_PaginationState,
    type MRT_SortingState,
} from 'material-react-table';
import { Box, Typography } from '@mui/material';
import fetchClient from '../../utils/fetchClient';

// --- Type Definitions ---
type SnapshotInstanceApiPropertyType = {
    snapshotId: string;
    hostId: string;
    instanceApiId: string;
    propertyId: string;
    propertyValue: string;
};

export default function ConfigSnapshotInstanceApiProperty() {
    const location = useLocation();
    const snapshotId = location.state?.data?.snapshotId;

    // Data and fetching state
    const [data, setData] = useState<SnapshotInstanceApiPropertyType[]>([]);
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);

    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<MRT_SortingState>([]);
    const [pagination, setPagination] = useState<MRT_PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });

    // Data fetching logic
    const fetchData = useCallback(async () => {
        if (!snapshotId) return;
        if (!data.length) setIsLoading(true); else setIsRefetching(true);

        const cmd = {
            host: 'lightapi.net', service: 'config', action: 'getSnapshotInstanceApiProperty', version: '0.1.0',
            data: {
                snapshotId, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
                sorting: JSON.stringify(sorting ?? []),
                filters: JSON.stringify(columnFilters ?? []),
                globalFilter: globalFilter ?? '',
            },
        };

        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const json = await fetchClient(url);
            console.log("Fetched Snapshot Instance Api Properties:", json);
            setData(json.data || []);
            setRowCount(json.totalCount || 0);
        } catch (error) {
            setIsError(true); console.error(error);
        } finally {
            setIsError(false); setIsLoading(false); setIsRefetching(false);
        }
    }, [snapshotId, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, data.length]);

    // useEffect to trigger fetchData
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<SnapshotInstanceApiPropertyType>[]>(
        () => [
            { accessorKey: 'instanceApiId', header: 'Instance Api Id' },
            { accessorKey: 'propertyId', header: 'Property Id' },
            { accessorKey: 'propertyValue', header: 'Property Value' },
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
        getRowId: (row) => `${row.instanceApiId}-${row.propertyId}`,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: false,
        renderTopToolbarCustomActions: () => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6">Snapshot Instance API Properties</Typography>
                {snapshotId && (
                    <Typography variant="subtitle1">
                        For Snapshot: <strong>{snapshotId}</strong>
                    </Typography>
                )}
            </Box>
        ),
    });

    return <MaterialReactTable table={table} />;
}
