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
type SkillToolApiResponse = {
    skillTools: Array<SkillToolType>;
    total: number;
};

type SkillToolType = {
    hostId: string;
    skillId: string;
    toolId: string;
    config?: string;
    accessLevel?: string;
    aggregateVersion: number;
    active: boolean;
    updateUser?: string;
    updateTs?: string;
};

interface UserState {
    host?: string;
}

export default function SkillTool() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;

    // Data and fetching state
    const [data, setData] = useState<SkillToolType[]>([]);
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
            host: 'lightapi.net', service: 'genai', action: 'getSkillTool', version: '0.1.0',
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
            setData(json.skillTools || []);
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
    const handleDelete = useCallback(async (row: MRT_Row<SkillToolType>) => {
        if (!window.confirm(`Are you sure you want to delete skill-tool association for Tool: ${row.original.toolId}?`)) return;

        const originalData = [...data];
        setData(prev => prev.filter(d => !(d.skillId === row.original.skillId && d.toolId === row.original.toolId)));
        setRowCount(prev => prev - 1);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'getFreshSkillTool', version: '0.1.0',
            data: { hostId: row.original.hostId, skillId: row.original.skillId, toolId: row.original.toolId },
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const freshData = await fetchClient(url);

            const deleteCmd = {
                host: 'lightapi.net', service: 'genai', action: 'deleteSkillTool', version: '0.1.0',
                data: { ...freshData, aggregateVersion: freshData.aggregateVersion },
            };

            const result = await apiPost({ url: '/portal/command', headers: {}, body: deleteCmd });
            if (result.error) {
                alert('Failed to delete skill-tool association. Please try again.');
                setData(originalData);
                setRowCount(originalData.length);
            }
        } catch (e) {
            console.error('Failed to delete skill-tool association:', e);
            alert('Failed to delete skill-tool association due to a network error.');
            setData(originalData);
            setRowCount(originalData.length);
        }
    }, [data]);

    const handleUpdate = useCallback(async (row: MRT_Row<SkillToolType>) => {
        const rowKey = `${row.original.skillId}-${row.original.toolId}`;
        setIsUpdateLoading(rowKey);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'getFreshSkillTool', version: '0.1.0',
            data: { hostId: row.original.hostId, skillId: row.original.skillId, toolId: row.original.toolId },
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const freshData = await fetchClient(url);

            // Navigate with the fresh data
            navigate('/app/form/updateSkillTool', {
                state: {
                    data: freshData,
                    source: location.pathname
                }
            });
        } catch (error) {
            console.error("Failed to fetch skill-tool association for update:", error);
            alert("Could not load the latest skill-tool association data. Please try again.");
        } finally {
            setIsUpdateLoading(null);
        }
    }, [navigate, location.pathname]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<SkillToolType>[]>(
        () => [
            { accessorKey: 'hostId', header: 'Host Id' },
            { accessorKey: 'skillId', header: 'Skill Id' },
            { accessorKey: 'toolId', header: 'Tool Id' },
            { accessorKey: 'config', header: 'Config' },
            { accessorKey: 'accessLevel', header: 'Access Level' },
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
        getRowId: (row) => `${row.skillId}-${row.toolId}`,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: true,
        positionActionsColumn: 'first',
        renderRowActions: ({ row }) => {
            const rowKey = `${row.original.skillId}-${row.original.toolId}`;
            return (
                <Box sx={{ display: 'flex', gap: '1rem' }}>
                    <Tooltip title="Update Skill-Tool Association">
                        <IconButton
                            onClick={() => handleUpdate(row)}
                            disabled={isUpdateLoading === rowKey}
                        >
                            {isUpdateLoading === rowKey ? (
                                <CircularProgress size={22} />
                            ) : (
                                <SystemUpdateIcon />
                            )}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Skill-Tool Association">
                        <IconButton color="error" onClick={() => handleDelete(row)}>
                            <DeleteForeverIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            );
        },
        renderTopToolbarCustomActions: () => (
            <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createSkillTool')}>
                Create New Skill Tool
            </Button>
        ),
    });

    return <MaterialReactTable table={table} />;
}
