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
import { Button, IconButton, Tooltip, CircularProgress, Box } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { buildWorkflowTaskContext, buildWorkflowTaskRoute, WorkflowTaskLayout } from './workflowTaskUtils';

// --- Type Definitions ---
type TaskAsstApiResponse = {
    taskAssts: Array<TaskAsstType>;
    total: number;
};

type TaskAsstType = {
    hostId: string;
    taskAsstId: string;
    taskId: string;
    assignedTs: string;
    assigneeId: string;
    assignmentType?: string;
    assignmentId?: string;
    reasonCode: string;
    unassignedTs?: string;
    unassignedReason?: string;
    categoryCode?: string;
    statusCode?: string;
    claimedBy?: string;
    claimedTs?: string;
    claimExpiresTs?: string;
    aggregateVersion: number;
    active: boolean;
    updateUser?: string;
    updateTs?: string;
};

interface UserState {
    host?: string;
}

export default function TaskAsst() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const taskContext = useMemo(() => buildWorkflowTaskContext(host, searchParams), [host, searchParams]);
    const contextForRow = useCallback(
        (row: TaskAsstType) => buildWorkflowTaskContext(host, searchParams, row),
        [host, searchParams],
    );
    const initialColumnFilters = useMemo<MRT_ColumnFiltersState>(() => {
        const filters: MRT_ColumnFiltersState = [{ id: 'active', value: 'true' }];
        const assigneeId = searchParams.get('assigneeId');
        const categoryCode = searchParams.get('categoryCode') || searchParams.get('categoryId');
        if (assigneeId) filters.push({ id: 'assigneeId', value: assigneeId });
        if (categoryCode) filters.push({ id: 'categoryCode', value: categoryCode });
        return filters;
    }, [searchParams]);

    // Data and fetching state
    const [data, setData] = useState<TaskAsstType[]>([]);
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);
    const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(initialColumnFilters);
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
            host: 'lightapi.net', service: 'workflow', action: 'getTaskAsst', version: '0.1.0',
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
            setData(json.taskAssts || []);
            setRowCount(json.total || 0);
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

    // Delete handler with optimistic update
    const handleDelete = useCallback(async (row: MRT_Row<TaskAsstType>) => {
        if (!window.confirm(`Are you sure you want to delete task assignment: ${row.original.taskAsstId}?`)) return;

        const originalData = [...data];
        setData(prev => prev.filter(d => d.taskAsstId !== row.original.taskAsstId));
        setRowCount(prev => prev - 1);

        const cmd = {
            host: 'lightapi.net', service: 'workflow', action: 'deleteTaskAsst', version: '0.1.0',
      data: { hostId: row.original.hostId, taskAsstId: row.original.taskAsstId , aggregateVersion: row.original.aggregateVersion},
        };

        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                alert('Failed to delete task assignment. Please try again.');
                setData(originalData);
                setRowCount(originalData.length);
            }
        } catch (e) {
            alert('Failed to delete task assignment due to a network error.');
            setData(originalData);
            setRowCount(originalData.length);
        }
    }, [data]);

    const handleUpdate = useCallback(async (row: MRT_Row<TaskAsstType>) => {
        const taskAsstId = row.original.taskAsstId;
        setIsUpdateLoading(taskAsstId);

        const cmd = {
            host: 'lightapi.net', service: 'workflow', action: 'getFreshTaskAsst', version: '0.1.0',
      data: { hostId: row.original.hostId, aggregateVersion: row.original.aggregateVersion, taskAsstId: row.original.taskAsstId },
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
        try {
            const freshData = await fetchClient(url);
            console.log("freshData", freshData);
      const dataForForm = freshData.aggregateVersion === row.original.aggregateVersion ? row.original : freshData;

            // Navigate with the fresh data
            navigate(buildWorkflowTaskRoute('/app/form/updateTaskAsst', searchParams, contextForRow(row.original)), {
                state: {
                    data: dataForForm,
                    source: location.pathname
                }
            });
        } catch (error) {
            console.error("Failed to fetch task assignment for update:", error);
            alert("Could not load the latest task assignment data. Please try again.");
        } finally {
            setIsUpdateLoading(null);
        }
    }, [navigate, location.pathname, searchParams, contextForRow]);

    const handleOpenTask = useCallback((row: MRT_Row<TaskAsstType>) => {
        const context = contextForRow(row.original);
        navigate(buildWorkflowTaskRoute('/app/workflow/HumanTask', searchParams, context), {
            state: { source: location.pathname + location.search },
        });
    }, [contextForRow, location.pathname, location.search, navigate, searchParams]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<TaskAsstType>[]>(
        () => [
            { accessorKey: 'hostId', header: 'Host Id' },
            { accessorKey: 'taskAsstId', header: 'Task Asst Id' },
            { accessorKey: 'taskId', header: 'Task Id' },
            {
                accessorKey: 'assignedTs',
                header: 'Assigned Time',
                Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
            },
            { accessorKey: 'assigneeId', header: 'Assignee' },
            { accessorKey: 'assignmentType', header: 'Assignment Type' },
            { accessorKey: 'assignmentId', header: 'Assignment Id' },
            { accessorKey: 'statusCode', header: 'Status' },
            { accessorKey: 'reasonCode', header: 'Reason Code' },
            { accessorKey: 'categoryCode', header: 'Category' },
            { accessorKey: 'claimedBy', header: 'Claimed By' },
            {
                accessorKey: 'claimedTs',
                header: 'Claimed Time',
                Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
            },
            {
                accessorKey: 'unassignedTs',
                header: 'Unassigned Time',
                Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
            },
            { accessorKey: 'unassignedReason', header: 'Unassigned Reason' },
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
                filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
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
        getRowId: (row) => row.taskAsstId,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: true,
        positionActionsColumn: 'first',
        renderRowActions: ({ row }) => (
            <Box sx={{ display: 'flex', gap: '1rem' }}>
                <Tooltip title="Open Human Task">
                    <span>
                        <IconButton
                            color="primary"
                            onClick={() => handleOpenTask(row)}
                            disabled={!row.original.active || !['ASSIGNED', 'CLAIMED'].includes(row.original.statusCode || '')}
                        >
                            <PlayCircleOutlineIcon />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title="Update Task Asst">
                    <IconButton
                        onClick={() => handleUpdate(row)}
                        disabled={isUpdateLoading === row.original.taskAsstId}
                    >
                        {isUpdateLoading === row.original.taskAsstId ? (
                            <CircularProgress size={22} />
                        ) : (
                            <SystemUpdateIcon />
                        )}
                    </IconButton>
                </Tooltip>
                <Tooltip title="Delete Task Asst">
                    <IconButton color="error" onClick={() => handleDelete(row)}>
                        <DeleteForeverIcon />
                    </IconButton>
                </Tooltip>
            </Box>
        ),
        renderTopToolbarCustomActions: () => (
            <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate(buildWorkflowTaskRoute('/app/form/createTaskAsst', searchParams, taskContext))}>
                Create New Task Asst
            </Button>
        ),
    });

    return (
        <WorkflowTaskLayout context={taskContext}>
            <MaterialReactTable table={table} />
        </WorkflowTaskLayout>
    );
}
