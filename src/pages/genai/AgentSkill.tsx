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
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';

// --- Type Definitions ---
type AgentSkillApiResponse = {
    agentSkills: Array<AgentSkillType>;
    total: number;
};

type AgentSkillType = {
    hostId: string;
    agentDefId: string;
    skillId: string;
    config?: string;
    priority?: number;
    sequenceId?: number;
    aggregateVersion: number;
    active: boolean;
    updateUser?: string;
    updateTs?: string;
};

interface UserState {
    host?: string;
}

export default function AgentSkill() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;

    // Data and fetching state
    const [data, setData] = useState<AgentSkillType[]>([]);
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
            host: 'lightapi.net', service: 'genai', action: 'getAgentSkill', version: '0.1.0',
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
            setData(json.agentSkills || []);
            setRowCount(json.total || 0);
        } catch (error) {
            setIsError(true); console.error(error);
        } finally {
            setIsError(false); setIsLoading(false); setIsRefetching(false);
        }
    }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

    // useEffect to trigger fetchData
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Delete handler with optimistic update
    const handleDelete = useCallback(async (row: MRT_Row<AgentSkillType>) => {
        if (!window.confirm(`Are you sure you want to delete skill ${row.original.skillId} from agent ${row.original.agentDefId}?`)) return;

        const originalData = [...data];
        setData(prev => prev.filter(d => d.agentDefId !== row.original.agentDefId || d.skillId !== row.original.skillId));
        setRowCount(prev => prev - 1);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'deleteAgentSkill', version: '0.1.0',
            data: { ...row.original, aggregateVersion: row.original.aggregateVersion },
        };

        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                alert('Failed to delete agent skill. Please try again.');
                setData(originalData);
                setRowCount(originalData.length);
            }
        } catch (e) {
            alert('Failed to delete agent skill due to a network error.');
            setData(originalData);
            setRowCount(originalData.length);
        }
    }, [data]);

    const handleUpdate = useCallback(async (row: MRT_Row<AgentSkillType>) => {
        const idKey = `${row.original.agentDefId}-${row.original.skillId}`;
        setIsUpdateLoading(idKey);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'getFreshAgentSkill', version: '0.1.0',
            data: row.original,
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
        try {
            const freshData = await fetchClient(url);
            console.log("freshData", freshData);

            // Navigate with the fresh data
            navigate('/app/form/updateAgentSkill', {
                state: {
                    data: freshData,
                    source: location.pathname
                }
            });
        } catch (error) {
            console.error("Failed to fetch agent skill for update:", error);
            alert("Could not load the latest agent skill data. Please try again.");
        } finally {
            setIsUpdateLoading(null);
        }
    }, [navigate, location.pathname]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<AgentSkillType>[]>(
        () => [
            { accessorKey: 'hostId', header: 'Host Id' },
            { accessorKey: 'agentDefId', header: 'Agent Def Id' },
            { accessorKey: 'skillId', header: 'Skill Id' },
            { accessorKey: 'config', header: 'Config' },
            { accessorKey: 'priority', header: 'Priority' },
            { accessorKey: 'sequenceId', header: 'Sequence Id' },
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
        [handleDelete, handleUpdate, navigate],
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
        getRowId: (row) => `${row.agentDefId}-${row.skillId}`,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: true,
        positionActionsColumn: 'first',
        renderRowActions: ({ row }) => {
            const idKey = `${row.original.agentDefId}-${row.original.skillId}`;
            return (
                <Box sx={{ display: 'flex', gap: '1rem' }}>
                    <Tooltip title="Update Agent Skill">
                        <IconButton
                            onClick={() => handleUpdate(row)}
                            disabled={isUpdateLoading === idKey}
                        >
                            {isUpdateLoading === idKey ? (
                                <CircularProgress size={22} />
                            ) : (
                                <SystemUpdateIcon />
                            )}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Agent Skill">
                        <IconButton color="error" onClick={() => handleDelete(row)}>
                            <DeleteForeverIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            );
        },
        renderTopToolbarCustomActions: () => (
            <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createAgentSkill')}>
                Create New Agent Skill
            </Button>
        ),
    });

    return <MaterialReactTable table={table} />;
}
