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
import { Alert, Box, Button, IconButton, Tooltip, CircularProgress, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { applyOwnershipColumns, applyOwnershipFilter, defaultAllScopeRoles, ownershipScope } from '../../utils/ownershipScope';
import { buildWorkflowTaskContext, buildWorkflowTaskRoute, WorkflowTaskLayout } from './workflowTaskUtils';

// --- Type Definitions ---
type WfDefinitionApiResponse = {
    workflows: Array<WfDefinitionType>;
    total: number;
};

type WfDefinitionType = {
    hostId: string;
    wfDefId: string;
    namespace: string;
    name: string;
    version: string;
    definition: string;
    aggregateVersion: number;
    active: boolean;
    updateUser?: string;
    updateTs?: string;
};

interface UserState {
    host?: string;
    userId?: string;
    email?: string;
    roles?: string | null;
  positions?: string | null;
}

const allWorkflowScopeRoles = [...defaultAllScopeRoles, 'workflow-admin'];

export default function WfDefinition() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host, userId, email, roles, positions } = useUserState() as UserState;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const workflowOwnership = useMemo(
        () => ownershipScope({
            roles,
            positions,
      ownerField: 'ownerUserId',
            allScopeRoles: allWorkflowScopeRoles,
        }),
        [roles, userId, positions],
    );
    const ownedOnly = workflowOwnership.ownedOnly;
    const hasOwnerContext = workflowOwnership.hasOwnerContext;
    const taskContext = useMemo(() => buildWorkflowTaskContext(host, searchParams), [host, searchParams]);
    const contextForRow = useCallback(
        (row: WfDefinitionType) => buildWorkflowTaskContext(host, searchParams, row),
        [host, searchParams],
    );

    // Data and fetching state
    const [data, setData] = useState<WfDefinitionType[]>([]);
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
        if (ownedOnly && !userId) return;
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

        const scopedFilters = applyOwnershipFilter(apiFilters, workflowOwnership);

        const cmd = {
            host: 'lightapi.net', service: 'workflow', action: 'getWfDefinition', version: '0.1.0',
            data: {
                hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
                sorting: JSON.stringify(sorting ?? []),
                filters: JSON.stringify(scopedFilters ?? []),
                globalFilter: globalFilter ?? '',
                active: activeStatus,
            },
        };

        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const json = await fetchClient(url);
            if (import.meta.env.DEV) {
                console.log('json', json);
            }
            setData(json.workflows || []);
            setRowCount(json.total || 0);
        } catch (error) {
            setIsError(true); console.error(error);
        } finally {
            setIsError(false); setIsLoading(false); setIsRefetching(false);
        }
    }, [host, userId, ownedOnly, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, workflowOwnership]);

    // useEffect to trigger fetchData
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Delete handler with optimistic update
    const handleDelete = useCallback(async (row: MRT_Row<WfDefinitionType>) => {
        if (!workflowOwnership.canModifyRecord(row.original)) {
            alert('You can only delete workflow definitions you own.');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete workflow definition: ${row.original.name} (ID: ${row.original.wfDefId})?`)) return;

        const originalData = [...data];
        setData(prev => prev.filter(d => d.wfDefId !== row.original.wfDefId));
        setRowCount(prev => prev - 1);

        const cmd = {
            host: 'lightapi.net', service: 'workflow', action: 'deleteWfDefinition', version: '0.1.0',
      data: { hostId: row.original.hostId, wfDefId: row.original.wfDefId, aggregateVersion: row.original.aggregateVersion },
        };

        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                alert('Failed to delete workflow definition. Please try again.');
                setData(originalData);
                setRowCount(originalData.length);
            }
        } catch (e) {
            alert('Failed to delete workflow definition due to a network error.');
            setData(originalData);
            setRowCount(originalData.length);
        }
    }, [workflowOwnership, data]);

    const handleUpdate = useCallback(async (row: MRT_Row<WfDefinitionType>) => {
        if (!workflowOwnership.canModifyRecord(row.original)) {
            alert('You can only update workflow definitions you own.');
            return;
        }
        const wfDefId = row.original.wfDefId;
        setIsUpdateLoading(wfDefId);

        const cmd = {
            host: 'lightapi.net', service: 'workflow', action: 'getFreshWfDefinition', version: '0.1.0',
      data: { hostId: row.original.hostId, wfDefId: row.original.wfDefId, aggregateVersion: row.original.aggregateVersion },
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const freshData = await fetchClient(url);
            console.log("freshData", freshData);
      const dataForForm = freshData.aggregateVersion === row.original.aggregateVersion ? row.original : freshData;

            navigate(buildWorkflowTaskRoute('/app/workflow/editor', searchParams, contextForRow(row.original)), {
                state: {
                    data: dataForForm,
                    source: location.pathname
                }
            });
        } catch (error) {
            console.error("Failed to fetch workflow definition for update:", error);
            alert("Could not load the latest workflow definition data. Please try again.");
        } finally {
            setIsUpdateLoading(null);
        }
    }, [workflowOwnership, navigate, location.pathname, searchParams, contextForRow]);

    const handleStart = useCallback((row: MRT_Row<WfDefinitionType>) => {
        navigate(buildWorkflowTaskRoute('/app/form/startWorkflow', searchParams, contextForRow(row.original)), {
            state: {
                data: {
                    hostId: row.original.hostId,
                    wfDefId: row.original.wfDefId,
                    input: "{}"
                },
                source: location.pathname
            }
        });
    }, [navigate, location.pathname, searchParams, contextForRow]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<WfDefinitionType>[]>(
        () => applyOwnershipColumns([
                { accessorKey: 'hostId', header: 'Host Id' },
                { accessorKey: 'wfDefId', header: 'Wf Def Id' },
                { accessorKey: 'namespace', header: 'Namespace' },
                { accessorKey: 'name', header: 'Name' },
                { accessorKey: 'version', header: 'Version' },
                {
                    accessorKey: 'definition', header: 'Definition',
                    Cell: ({ cell }) => (
                        <Tooltip title={cell.getValue<string>()}>
                            <span style={{
                                display: 'inline-block',
                                maxWidth: '200px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {cell.getValue<string>()}
                            </span>
                        </Tooltip>
                    )
                },
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
            workflowOwnership,
        ),
        [workflowOwnership],
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
        getRowId: (row) => row.wfDefId,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: true,
        positionActionsColumn: 'first',
        renderRowActions: ({ row }) => (
            <Box sx={{ display: 'flex', gap: '1rem' }}>
                <Tooltip title={workflowOwnership.canModifyRecord(row.original) ? 'Update Workflow Definition' : 'You can only update workflow definitions you own.'}>
                    <span>
                        <IconButton
                            onClick={() => handleUpdate(row)}
                            disabled={!workflowOwnership.canModifyRecord(row.original) || isUpdateLoading === row.original.wfDefId}
                        >
                            {isUpdateLoading === row.original.wfDefId ? (
                                <CircularProgress size={22} />
                            ) : (
                                <SystemUpdateIcon />
                            )}
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title="Start Workflow">
                    <IconButton color="primary" onClick={() => handleStart(row)}>
                        <PlayArrowIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title={workflowOwnership.canModifyRecord(row.original) ? 'Delete Workflow Definition' : 'You can only delete workflow definitions you own.'}>
                    <span>
                        <IconButton color="error" onClick={() => handleDelete(row)} disabled={!workflowOwnership.canModifyRecord(row.original)}>
                            <DeleteForeverIcon />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>
        ),
        renderTopToolbarCustomActions: () => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate(buildWorkflowTaskRoute('/app/workflow/editor', searchParams, taskContext), { state: { data: { hostId: host }, source: location.pathname } })}>
                    Create New WfDefinition
                </Button>
                {ownedOnly ? (
                    <Typography variant="subtitle1">My Workflow Definitions: <strong>{email || userId}</strong></Typography>
                ) : (
                    <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600 }}>Admin View: All Workflow Definitions</Typography>
                )}
            </Box>
        ),
    });

    return (
        <WorkflowTaskLayout context={taskContext}>
            {!hasOwnerContext && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    User context is required before owner-scoped workflow definitions can be loaded.
                </Alert>
            )}
            <MaterialReactTable table={table} />
        </WorkflowTaskLayout>
    );
}
