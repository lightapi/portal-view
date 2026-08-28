
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_ColumnFiltersState,
    type MRT_PaginationState,
    type MRT_SortingState,
    type MRT_Cell,
    type MRT_RowData
} from 'material-react-table';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Box, IconButton, Typography, Tooltip } from '@mui/material';
import fetchClient from '../../utils/fetchClient';
import { loadErrorMessage } from '../../utils/loadErrorMessage';

// --- Type Definitions ---
type ConfigSnapshotPropertyType = {
    snapshotPropertyId: string;
    snapshotId: string;
    configPhase: string;
    configId: string;
    configName?: string;
    propertyId: string;
    propertyName: string;
    propertyType: string;
    propertyValue: string;
    valueType: string;
    sourceLevel: string;
};

const TruncatedCell = <T extends MRT_RowData>({ cell }: { cell: MRT_Cell<T, unknown> }) => {
    const value = cell.getValue<string>() ?? '';
    return <CopyablePropertyValue value={value} />;
};

export function CopyablePropertyValue({ value }: { value: string }) {
    const copyValue = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        void navigator.clipboard?.writeText(value);
    };

    return (
        <Tooltip
            describeChild
            placement="top-start"
            slotProps={{
                tooltip: { sx: { maxWidth: 600, maxHeight: 400, overflow: 'auto' } },
            }}
            title={(
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <Typography
                        component="span"
                        sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text', flex: 1 }}
                    >
                        {value}
                    </Typography>
                    <IconButton
                        aria-label="Copy property value"
                        color="inherit"
                        size="small"
                        onClick={copyValue}
                        sx={{ mt: -0.5, mr: -0.5 }}
                    >
                        <ContentCopyIcon fontSize="inherit" />
                    </IconButton>
                </Box>
            )}
        >
            <Box component="span" sx={{ display: 'block', maxWidth: '200px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {value}
            </Box>
        </Tooltip>
    );
}

export default function ConfigSnapshotProperty() {
    const location = useLocation();
    const snapshotId = location.state?.data?.snapshotId;

    // Data and fetching state
    const [data, setData] = useState<ConfigSnapshotPropertyType[]>([]);
    const [isError, setIsError] = useState<string | false>(false);
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
        setIsError(false);
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
            setIsError(loadErrorMessage(error)); console.error(error);
        } finally {
            setIsLoading(false); setIsRefetching(false);
        }
    }, [snapshotId, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

    // useEffect to trigger fetchData
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<ConfigSnapshotPropertyType>[]>(
        () => [
            { accessorKey: 'configPhase', header: 'Phase' },
            { accessorKey: 'configName', header: 'Config Name' },
            { accessorKey: 'propertyName', header: 'Property Name' },
            { accessorKey: 'propertyType', header: 'Property Type' },
            {
                accessorKey: 'propertyValue',
                header: 'Property Value',
                Cell: TruncatedCell,
            },
            { accessorKey: 'valueType', header: 'Value Type' },
            { accessorKey: 'sourceLevel', header: 'Source Level' },
            { accessorKey: 'snapshotPropertyId', header: 'Snapshot Property Id' },
            { accessorKey: 'snapshotId', header: 'Snapshot Id' },
            { accessorKey: 'configId', header: 'Config Id' },
            { accessorKey: 'propertyId', header: 'Property Id' },
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
        state: { isLoading, showAlertBanner: Boolean(isError), showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter },
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        getRowId: (row) => row.snapshotPropertyId,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: typeof isError === 'string' ? isError : 'Error loading data' } : undefined,
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
