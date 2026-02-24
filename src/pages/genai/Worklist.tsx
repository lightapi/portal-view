import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_ColumnDef,
    type MRT_ColumnFiltersState,
    type MRT_PaginationState,
    type MRT_SortingState,
    type MRT_Row,
} from 'material-react-table';
import { Button, IconButton, Tooltip, CircularProgress } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';

// --- Type Definitions ---
type WorklistApiResponse = {
    worklists: Array<WorklistType>;
    total: number;
};

type WorklistType = {
    hostId: string;
    assigneeId: string;
    categoryId: string;
    statusCode: string;
    appId: string;
    aggregateVersion: number;
    active: boolean;
    updateUser?: string;
    updateTs?: string;
};

interface UserState {
    host?: string;
}

export default function Worklist() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;

    // Data and fetching state
    const [data, setData] = useState<WorklistType[]>([]);
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);
    const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([
        { id: 'active', value: 'true' }
    ]);
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
            host: 'lightapi.net', service: 'genai', action: 'getWorklist', version: '0.1.0',
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
            setData(json.worklists || []);
            setRowCount(json.total || 0);
        } catch (error) {
            setIsError(true); console.error(error);
        } finally {
            setIsError(false); setIsLoading(false); setIsRefetching(false);
        }
    }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, data.length]);

    // useEffect to trigger fetchData
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Helper ID generator for loading states and rendering keys
    const getRowId = (row: MRT_Row<WorklistType> | WorklistType) => {
        const data = "original" in row ? row.original : row;
        return `${data.assigneeId}|${data.categoryId}`;
    };

    // Delete handler with optimistic update
    const handleDelete = useCallback(async (row: MRT_Row<WorklistType>) => {
        const rowId = getRowId(row);
        if (!window.confirm(`Are you sure you want to delete worklist for Assignee: ${row.original.assigneeId}, Category: ${row.original.categoryId}?`)) return;

        const originalData = [...data];
        setData(prev => prev.filter(d => getRowId(d) !== rowId));
        setRowCount(prev => prev - 1);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'deleteWorklist', version: '0.1.0',
            data: { ...row.original, aggregateVersion: row.original.aggregateVersion },
        };

        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                alert('Failed to delete worklist. Please try again.');
                setData(originalData);
                setRowCount(originalData.length);
            }
        } catch (e) {
            alert('Failed to delete worklist due to a network error.');
            setData(originalData);
            setRowCount(originalData.length);
        }
    }, [data]);

    const handleUpdate = useCallback(async (row: MRT_Row<WorklistType>) => {
        const rowId = getRowId(row);
        setIsUpdateLoading(rowId);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'getFreshWorklist', version: '0.1.0',
            data: row.original,
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const freshData = await fetchClient(url);
            console.log("freshData", freshData);

            // Navigate with the fresh data
            navigate('/app/form/updateWorklist', {
                state: {
                    data: freshData,
                    source: location.pathname
                }
            });
        } catch (error) {
            console.error("Failed to fetch worklist for update:", error);
            alert("Could not load the latest worklist data. Please try again.");
        } finally {
            setIsUpdateLoading(null);
        }
    }, [navigate, location.pathname]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<WorklistType>[]>(
        () => [
            { accessorKey: 'hostId', header: 'Host Id' },
            { accessorKey: 'assigneeId', header: 'Assignee Id' },
            { accessorKey: 'categoryId', header: 'Category Id' },
            { accessorKey: 'statusCode', header: 'Status' },
            { accessorKey: 'appId', header: 'App Id' },
            { accessorKey: 'updateUser', header: 'Update User' },
            {
                accessorKey: 'updateTs',
                header: 'Update Time',
                Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
            },
            { accessorKey: 'aggregateVersion', header: 'AggregateVersion' },
            {
                accessorKey: 'active',
                header: 'Active',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
            },
            {
                id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
                Cell: ({ row }) => (
                    <Tooltip title="Update Worklist">
                        <IconButton
                            onClick={() => handleUpdate(row)}
                            disabled={isUpdateLoading === getRowId(row)}
                        >
                            {isUpdateLoading === getRowId(row) ? (
                                <CircularProgress size={22} />
                            ) : (
                                <SystemUpdateIcon />
                            )}
                        </IconButton>
                    </Tooltip>
                )
            },
            {
                id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
                Cell: ({ row }) => (<Tooltip title="Delete Worklist"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
            },
        ],
        [handleDelete, handleUpdate, isUpdateLoading],
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
        getRowId: (row) => getRowId(row),
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: false,
        renderTopToolbarCustomActions: () => (
            <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createWorklist')}>
                Create New Worklist
            </Button>
        ),
    });

    return <MaterialReactTable table={table} />;
}
