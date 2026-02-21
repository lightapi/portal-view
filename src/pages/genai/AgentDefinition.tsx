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
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type AgentDefinitionApiResponse = {
    agentDefinitions: Array<AgentDefinitionType>;
    total: number;
};

type AgentDefinitionType = {
    hostId: string;
    agentDefId: string;
    agentName: string;
    modelProvider: string;
    modelName: string;
    apiKeyRef?: string;
    temperature?: number;
    maxTokens?: number;
    aggregateVersion: number;
    active: boolean;
    updateUser?: string;
    updateTs?: string;
};

interface UserState {
    host?: string;
}

export default function AgentDefinition() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;

    // Data and fetching state
    const [data, setData] = useState<AgentDefinitionType[]>([]);
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
            host: 'lightapi.net', service: 'genai', action: 'getAgentDefinition', version: '0.1.0',
            data: {
                hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
                sorting: JSON.stringify(sorting ?? []),
                filters: JSON.stringify(apiFilters ?? []),
                globalFilter: globalFilter ?? '',
                active: activeStatus,
            },
        };

        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
        const cookies = new Cookies();
        const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

        try {
            const response = await fetch(url, { headers, credentials: 'include' });
            const json = (await response.json()) as AgentDefinitionApiResponse;
            setData(json.agentDefinitions || []);
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
    const handleDelete = useCallback(async (row: MRT_Row<AgentDefinitionType>) => {
        if (!window.confirm(`Are you sure you want to delete agent: ${row.original.agentName}?`)) return;

        const originalData = [...data];
        setData(prev => prev.filter(d => d.agentDefId !== row.original.agentDefId));
        setRowCount(prev => prev - 1);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'deleteAgentDefinition', version: '0.1.0',
            data: { ...row.original, aggregateVersion: row.original.aggregateVersion },
        };

        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                alert('Failed to delete agent definition. Please try again.');
                setData(originalData);
                setRowCount(originalData.length);
            }
        } catch (e) {
            alert('Failed to delete agent definition due to a network error.');
            setData(originalData);
            setRowCount(originalData.length);
        }
    }, [data]);

    const handleUpdate = useCallback(async (row: MRT_Row<AgentDefinitionType>) => {
        const agentDefId = row.original.agentDefId;
        setIsUpdateLoading(agentDefId);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'getFreshAgentDefinition', version: '0.1.0',
            data: row.original,
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
        const cookies = new Cookies();
        const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

        try {
            const response = await fetch(url, { headers, credentials: 'include' });
            const freshData = await response.json();
            console.log("freshData", freshData);
            if (!response.ok) {
                throw new Error(freshData.description || 'Failed to fetch latest agent definition data.');
            }

            // Navigate with the fresh data
            navigate('/app/form/updateAgentDefinition', {
                state: {
                    data: freshData,
                    source: location.pathname
                }
            });
        } catch (error) {
            console.error("Failed to fetch agent definition for update:", error);
            alert("Could not load the latest agent definition data. Please try again.");
        } finally {
            setIsUpdateLoading(null);
        }
    }, [navigate, location.pathname]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<AgentDefinitionType>[]>(
        () => [
            { accessorKey: 'hostId', header: 'Host Id' },
            { accessorKey: 'agentDefId', header: 'Agent Def Id' },
            { accessorKey: 'agentName', header: 'Agent Name' },
            { accessorKey: 'modelProvider', header: 'Model Provider' },
            { accessorKey: 'modelName', header: 'Model Name' },
            { accessorKey: 'apiKeyRef', header: 'API Key Ref' },
            { accessorKey: 'temperature', header: 'Temperature' },
            { accessorKey: 'maxTokens', header: 'Max Tokens' },
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
                    <Tooltip title="Update Agent Definition">
                        <IconButton
                            onClick={() => handleUpdate(row)}
                            disabled={isUpdateLoading === row.original.agentDefId}
                        >
                            {isUpdateLoading === row.original.agentDefId ? (
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
                Cell: ({ row }) => (<Tooltip title="Delete Agent Definition"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
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
        getRowId: (row) => row.agentDefId,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: false,
        renderTopToolbarCustomActions: () => (
            <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createAgentDefinition')}>
                Create New Agent Definition
            </Button>
        ),
    });

    return <MaterialReactTable table={table} />;
}
