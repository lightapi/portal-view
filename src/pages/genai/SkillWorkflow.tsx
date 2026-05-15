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
import EditNoteIcon from '@mui/icons-material/EditNote';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { buildGenAiTaskContext, buildGenAiTaskRoute, GenAiTaskLayout } from './genAiTaskUtils';

type SkillWorkflowApiResponse = {
    skillWorkflows: Array<SkillWorkflowType>;
    total: number;
};

export type SkillWorkflowType = {
    hostId: string;
    skillId: string;
    wfDefId: string;
    workflowRole: string;
    startMode?: string;
    config?: string;
    skillName?: string;
    workflowName?: string;
    workflowVersion?: string;
    aggregateVersion: number;
    active: boolean;
    updateUser?: string;
    updateTs?: string;
};

interface UserState {
    host?: string;
}

export default function SkillWorkflow() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const taskContext = useMemo(() => buildGenAiTaskContext(host, searchParams), [host, searchParams]);
    const contextForRow = useCallback(
        (row: SkillWorkflowType) => buildGenAiTaskContext(host, searchParams, row),
        [host, searchParams],
    );

    const [data, setData] = useState<SkillWorkflowType[]>([]);
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

    const fetchData = useCallback(async () => {
        if (!host) return;
        if (!data.length) setIsLoading(true); else setIsRefetching(true);

        let activeStatus = true;
        const apiFilters: MRT_ColumnFiltersState = [];
        columnFilters.forEach(filter => {
            if (filter.id === 'active') {
                activeStatus = filter.value === 'true' || filter.value === true;
            } else {
                apiFilters.push(filter);
            }
        });

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'getSkillWorkflow', version: '0.1.0',
            data: {
                hostId: host,
                offset: pagination.pageIndex * pagination.pageSize,
                limit: pagination.pageSize,
                sorting: JSON.stringify(sorting ?? []),
                filters: JSON.stringify(apiFilters ?? []),
                globalFilter: globalFilter ?? '',
                active: activeStatus,
            },
        };

        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const json: SkillWorkflowApiResponse = await fetchClient(url);
            setData(json.skillWorkflows || []);
            setRowCount(json.total || 0);
        } catch (error) {
            setIsError(true); console.error(error);
        } finally {
            setIsError(false); setIsLoading(false); setIsRefetching(false);
        }
    }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const rowKey = (row: SkillWorkflowType) => `${row.skillId}-${row.wfDefId}-${row.workflowRole}`;

    const handleDelete = useCallback(async (row: MRT_Row<SkillWorkflowType>) => {
        if (!window.confirm(`Are you sure you want to delete workflow link: ${row.original.workflowName || row.original.wfDefId}?`)) return;

        const originalData = [...data];
        setData(prev => prev.filter(d => rowKey(d) !== rowKey(row.original)));
        setRowCount(prev => prev - 1);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'getFreshSkillWorkflow', version: '0.1.0',
            data: {
                hostId: row.original.hostId,
                skillId: row.original.skillId,
                wfDefId: row.original.wfDefId,
                workflowRole: row.original.workflowRole,
                aggregateVersion: row.original.aggregateVersion,
            },
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const freshData = await fetchClient(url);
            const deleteCmd = {
                host: 'lightapi.net', service: 'genai', action: 'deleteSkillWorkflow', version: '0.1.0',
                data: { ...freshData, aggregateVersion: freshData.aggregateVersion },
            };

            const result = await apiPost({ url: '/portal/command', headers: {}, body: deleteCmd });
            if (result.error) {
                alert('Failed to delete skill workflow. Please try again.');
                setData(originalData);
                setRowCount(originalData.length);
            }
        } catch (e) {
            console.error('Failed to delete skill workflow:', e);
            alert('Failed to delete skill workflow due to a network error.');
            setData(originalData);
            setRowCount(originalData.length);
        }
    }, [data]);

    const handleUpdate = useCallback(async (row: MRT_Row<SkillWorkflowType>) => {
        const key = rowKey(row.original);
        setIsUpdateLoading(key);
        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'getFreshSkillWorkflow', version: '0.1.0',
            data: {
                hostId: row.original.hostId,
                skillId: row.original.skillId,
                wfDefId: row.original.wfDefId,
                workflowRole: row.original.workflowRole,
                aggregateVersion: row.original.aggregateVersion,
            },
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const freshData = await fetchClient(url);
            navigate(buildGenAiTaskRoute('/app/form/updateSkillWorkflow', searchParams, contextForRow(row.original)), {
                state: {
                    data: freshData,
                    source: location.pathname
                }
            });
        } catch (error) {
            console.error("Failed to fetch skill workflow for update:", error);
            alert("Could not load the latest skill workflow data. Please try again.");
        } finally {
            setIsUpdateLoading(null);
        }
    }, [navigate, location.pathname, searchParams, contextForRow]);

    const handleOpenEditor = useCallback((row: MRT_Row<SkillWorkflowType>) => {
        navigate('/app/workflow/editor', {
            state: {
                data: {
                    hostId: row.original.hostId,
                    wfDefId: row.original.wfDefId,
                },
                source: location.pathname,
            }
        });
    }, [navigate, location.pathname]);

    const handleStart = useCallback((row: MRT_Row<SkillWorkflowType>) => {
        navigate('/app/form/startWorkflow', {
            state: {
                data: {
                    hostId: row.original.hostId,
                    wfDefId: row.original.wfDefId,
                    input: row.original.config || "{}",
                },
                source: location.pathname,
            }
        });
    }, [navigate, location.pathname]);

    const columns = useMemo<MRT_ColumnDef<SkillWorkflowType>[]>(
        () => [
            { accessorKey: 'hostId', header: 'Host Id' },
            { accessorKey: 'skillId', header: 'Skill Id' },
            { accessorKey: 'skillName', header: 'Skill' },
            { accessorKey: 'wfDefId', header: 'Workflow Definition Id' },
            { accessorKey: 'workflowName', header: 'Workflow' },
            { accessorKey: 'workflowVersion', header: 'Workflow Version' },
            { accessorKey: 'workflowRole', header: 'Role' },
            { accessorKey: 'startMode', header: 'Start Mode' },
            { accessorKey: 'config', header: 'Config' },
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
        getRowId: (row) => rowKey(row),
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: true,
        positionActionsColumn: 'first',
        renderRowActions: ({ row }) => {
            const key = rowKey(row.original);
            return (
                <Box sx={{ display: 'flex', gap: '0.5rem' }}>
                    <Tooltip title="Update Skill Workflow">
                        <IconButton onClick={() => handleUpdate(row)} disabled={isUpdateLoading === key}>
                            {isUpdateLoading === key ? <CircularProgress size={22} /> : <SystemUpdateIcon />}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Open Workflow Editor">
                        <IconButton color="primary" onClick={() => handleOpenEditor(row)}>
                            <EditNoteIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Start Workflow">
                        <IconButton color="primary" onClick={() => handleStart(row)}>
                            <PlayArrowIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Skill Workflow">
                        <IconButton color="error" onClick={() => handleDelete(row)}>
                            <DeleteForeverIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            );
        },
        renderTopToolbarCustomActions: () => (
            <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate(buildGenAiTaskRoute('/app/form/createSkillWorkflow', searchParams, taskContext))}>
                Create New Skill Workflow
            </Button>
        ),
    });

    return (
        <GenAiTaskLayout context={taskContext}>
            <MaterialReactTable table={table} />
        </GenAiTaskLayout>
    );
}
