
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
type ConfigSnapshotPropertyType = {
    snapshotPropertyId: string;
    snapshotId: string;
    configPhase: string;
    configId: string;
    propertyId: string;
    propertyName: string;
    propertyType: string;
    propertyValue: string;
    valueType: string;
    sourceLevel: string;
};

export default function ConfigSnapshotProperty() {
    const location = useLocation();
    const snapshotId = location.state?.data?.snapshotId;

    // Data and fetching state
    const [data, setData] = useState<ConfigSnapshotPropertyType[]>([]);
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
            host: 'lightapi.net', service: 'config', action: 'getConfigSnapshotProperty', version: '0.1.0',
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
            console.log("Fetched Config Snapshot Properties:", json);
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
    const columns = useMemo<MRT_ColumnDef<ConfigSnapshotPropertyType>[]>(
        () => [
            { accessorKey: 'snapshotPropertyId', header: 'Snapshot Property Id' },
            { accessorKey: 'snapshotId', header: 'Snapshot Id' },
            { accessorKey: 'configPhase', header: 'Phase' },
            { accessorKey: 'configId', header: 'Config Id' },
            { accessorKey: 'propertyId', header: 'Property Id' },
            { accessorKey: 'propertyName', header: 'Property Name' },
            { accessorKey: 'propertyType', header: 'Property Type' },
            { accessorKey: 'propertyValue', header: 'Property Value' },
            { accessorKey: 'valueType', header: 'Value Type' },
            { accessorKey: 'sourceLevel', header: 'Source Level' },
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
        getRowId: (row) => row.snapshotPropertyId,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: false,
        renderTopToolbarCustomActions: () => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6">Config Snapshot Properties</Typography>
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
