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
type ProcessInfoApiResponse = {
    processInfos: Array<ProcessInfoType>;
    total: number;
};

type ProcessInfoType = {
    hostId: string;
    processId: string;
    wfDefId: string;
    wfInstanceId: string;
    appId: string;
    processType: string;
    statusCode: string;
    exTriggerTs: string;
    processSubtypeCode?: string;
    owningGroupName?: string;
    aggregateVersion: number;
    active: boolean;
    updateUser?: string;
    updateTs?: string;
};

interface UserState {
    host?: string;
}

export default function ProcessInfo() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;

    // Data and fetching state
    const [data, setData] = useState<ProcessInfoType[]>([]);
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
            host: 'lightapi.net', service: 'genai', action: 'getProcessInfo', version: '0.1.0',
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
            setData(json.processInfos || []);
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

    // Delete handler with optimistic update
    const handleDelete = useCallback(async (row: MRT_Row<ProcessInfoType>) => {
        if (!window.confirm(`Are you sure you want to delete process: ${row.original.processId}?`)) return;

        const originalData = [...data];
        setData(prev => prev.filter(d => d.processId !== row.original.processId));
        setRowCount(prev => prev - 1);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'deleteProcessInfo', version: '0.1.0',
            data: { ...row.original, aggregateVersion: row.original.aggregateVersion },
        };

        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                alert('Failed to delete process info. Please try again.');
                setData(originalData);
                setRowCount(originalData.length);
            }
        } catch (e) {
            alert('Failed to delete process info due to a network error.');
            setData(originalData);
            setRowCount(originalData.length);
        }
    }, [data]);

    const handleUpdate = useCallback(async (row: MRT_Row<ProcessInfoType>) => {
        const processId = row.original.processId;
        setIsUpdateLoading(processId);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'getFreshProcessInfo', version: '0.1.0',
            data: row.original,
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
        try {
            const freshData = await fetchClient(url);
            console.log("freshData", freshData);

            // Navigate with the fresh data
            navigate('/app/form/updateProcessInfo', {
                state: {
                    data: freshData,
                    source: location.pathname
                }
            });
        } catch (error) {
            console.error("Failed to fetch process info for update:", error);
            alert("Could not load the latest process info data. Please try again.");
        } finally {
            setIsUpdateLoading(null);
        }
    }, [navigate, location.pathname]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<ProcessInfoType>[]>(
        () => [
            { accessorKey: 'hostId', header: 'Host Id' },
            { accessorKey: 'processId', header: 'Process Id' },
            { accessorKey: 'wfDefId', header: 'Wf Def Id' },
            { accessorKey: 'wfInstanceId', header: 'Wf Instance Id' },
            { accessorKey: 'appId', header: 'App Id' },
            { accessorKey: 'processType', header: 'Process Type' },
            { accessorKey: 'statusCode', header: 'Status' },
            {
                accessorKey: 'exTriggerTs',
                header: 'Trigger Time',
                Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
            },
            { accessorKey: 'processSubtypeCode', header: 'Subtype Code' },
            { accessorKey: 'owningGroupName', header: 'Owning Group' },
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
                    <Tooltip title="Update Process Info">
                        <IconButton
                            onClick={() => handleUpdate(row)}
                            disabled={isUpdateLoading === row.original.processId}
                        >
                            {isUpdateLoading === row.original.processId ? (
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
                Cell: ({ row }) => (<Tooltip title="Delete Process Info"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
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
        getRowId: (row) => row.processId,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: false,
        renderTopToolbarCustomActions: () => (
            <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createProcessInfo')}>
                Create New Process Info
            </Button>
        ),
    });

    return <MaterialReactTable table={table} />;
}
