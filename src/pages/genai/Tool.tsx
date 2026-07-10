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
import { Box, Button, Chip, IconButton, Tooltip, CircularProgress } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import RefreshIcon from '@mui/icons-material/Refresh';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { buildGenAiTaskContext, buildGenAiTaskRoute, GenAiTaskLayout } from './genAiTaskUtils';

// --- Type Definitions ---
type ToolApiResponse = {
    tools: Array<ToolType>;
    total: number;
};

type ToolType = {
    hostId: string;
    toolId: string;
    name: string;
    description?: string;
    implementationType?: string;
    implementationClass?: string;
    mcpServerName?: string;
    apiEndpoint?: string;
    apiMethod?: string;
    endpointId?: string;
    scriptContent?: string;
    responseSchema?: string;
    routingDomain?: string;
    semanticNamespace?: string;
    sensitivityTier?: string;
    semanticWeight?: number;
    sourceProtocol?: string;
    lifecycleStatus?: string;
    costTier?: string;
    targetPersonas?: string;
    descriptionSource?: string;
    descriptionManualOverride?: boolean;
    descriptionOverrideTs?: string;
    descriptionOverrideUser?: string;
    descriptionEmbeddingModel?: string;
    descriptionEmbeddingDimension?: number;
    descriptionEmbeddingSourceHash?: string;
    descriptionEmbeddingTs?: string;
    descriptionEmbeddingStatus?: string;
    descriptionEmbeddingError?: string;
    descriptionEmbeddingPresent?: boolean;
    version?: string;
    aggregateVersion: number;
    active: boolean;
    updateUser?: string;
    updateTs?: string;
};

interface UserState {
    host?: string;
}

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

const embeddingStatusColor = (status?: string): ChipColor => {
    switch (status) {
        case 'ready': return 'success';
        case 'pending': return 'warning';
        case 'running': return 'info';
        case 'failed': return 'error';
        case 'disabled': return 'default';
        case 'blank': return 'default';
        default: return 'default';
    }
};

export default function Tool() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const taskContext = useMemo(() => buildGenAiTaskContext(host, searchParams), [host, searchParams]);
    const contextForRow = useCallback(
        (row: ToolType) => buildGenAiTaskContext(host, searchParams, row),
        [host, searchParams],
    );

    // Data and fetching state
    const [data, setData] = useState<ToolType[]>([]);
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);
    const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);
    const [isEmbeddingRefreshLoading, setIsEmbeddingRefreshLoading] = useState<string | null>(null);

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
            host: 'lightapi.net', service: 'genai', action: 'getTool', version: '0.1.0',
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
            setData(json.tools || []);
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
    const handleDelete = useCallback(async (row: MRT_Row<ToolType>) => {
        if (!window.confirm(`Are you sure you want to delete tool: ${row.original.toolId}?`)) return;

        const originalData = [...data];
        setData(prev => prev.filter(d => d.toolId !== row.original.toolId));
        setRowCount(prev => prev - 1);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'deleteTool', version: '0.1.0',
      data: { hostId: row.original.hostId, toolId: row.original.toolId , aggregateVersion: row.original.aggregateVersion},
        };

        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                alert('Failed to delete tool. Please try again.');
                setData(originalData);
                setRowCount(originalData.length);
            }
        } catch (e) {
            alert('Failed to delete tool due to a network error.');
            setData(originalData);
            setRowCount(originalData.length);
        }
    }, [data]);

    const handleUpdate = useCallback(async (row: MRT_Row<ToolType>) => {
        const toolId = row.original.toolId;
        setIsUpdateLoading(toolId);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'getFreshTool', version: '0.1.0',
      data: { hostId: row.original.hostId, aggregateVersion: row.original.aggregateVersion, toolId: row.original.toolId },
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const freshData = await fetchClient(url);
            console.log("freshData", freshData);
      const dataForForm = freshData.aggregateVersion === row.original.aggregateVersion ? row.original : freshData;

            // Navigate with the fresh data
            navigate(buildGenAiTaskRoute('/app/form/updateTool', searchParams, contextForRow(row.original)), {
                state: {
                    data: dataForForm,
                    source: location.pathname
                }
            });
        } catch (error) {
            console.error("Failed to fetch tool for update:", error);
            alert("Could not load the latest tool data. Please try again.");
        } finally {
            setIsUpdateLoading(null);
        }
    }, [navigate, location.pathname, searchParams, contextForRow]);

    const handleRefreshEmbedding = useCallback(async (row: MRT_Row<ToolType>) => {
        const toolId = row.original.toolId;
        const failed = row.original.descriptionEmbeddingStatus === 'failed';
        setIsEmbeddingRefreshLoading(toolId);

        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'refreshToolEmbedding', version: '0.1.0',
            data: {
                hostId: row.original.hostId,
                toolId,
                force: !failed,
            },
        };

        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                alert(failed ? 'Failed to retry embedding.' : 'Failed to refresh embedding.');
                return;
            }
            if ('data' in result && result.data?.queued) {
                setData(prev => prev.map(tool => tool.toolId === toolId
                    ? { ...tool, descriptionEmbeddingStatus: 'pending', descriptionEmbeddingError: undefined }
                    : tool));
            }
            await fetchData();
        } catch (e) {
            alert(failed ? 'Failed to retry embedding due to a network error.' : 'Failed to refresh embedding due to a network error.');
        } finally {
            setIsEmbeddingRefreshLoading(null);
        }
    }, [fetchData]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<ToolType>[]>(
        () => [
            { accessorKey: 'hostId', header: 'Host Id' },
            { accessorKey: 'toolId', header: 'Tool Id' },
            { accessorKey: 'name', header: 'Name' },
            { accessorKey: 'description', header: 'Description' },
            { accessorKey: 'implementationType', header: 'Implementation Type' },
            { accessorKey: 'endpointId', header: 'Endpoint Id' },
            { accessorKey: 'apiEndpoint', header: 'API Endpoint' },
            { accessorKey: 'apiMethod', header: 'API Method' },
            { accessorKey: 'routingDomain', header: 'Routing Domain' },
            { accessorKey: 'semanticNamespace', header: 'Semantic Namespace' },
            {
                accessorKey: 'sensitivityTier',
                header: 'Sensitivity Tier',
                filterVariant: 'select',
                filterSelectOptions: [
                    { label: 'Public', value: 'public' },
                    { label: 'Internal', value: 'internal' },
                    { label: 'Confidential', value: 'confidential' },
                    { label: 'Restricted', value: 'restricted' },
                ],
            },
            { accessorKey: 'semanticWeight', header: 'Semantic Weight' },
            {
                accessorKey: 'sourceProtocol',
                header: 'Source Protocol',
                filterVariant: 'select',
                filterSelectOptions: [
                    { label: 'OpenAPI', value: 'openapi' },
                    { label: 'MCP', value: 'mcp' },
                    { label: 'LightAPI', value: 'lightapi' },
                    { label: 'HTTP', value: 'http' },
                ],
            },
            {
                accessorKey: 'lifecycleStatus',
                header: 'Lifecycle',
                filterVariant: 'select',
                filterSelectOptions: [
                    { label: 'Active', value: 'active' },
                    { label: 'Deprecated', value: 'deprecated' },
                    { label: 'Retired', value: 'retired' },
                ],
                Cell: ({ cell }) => {
                    const value = cell.getValue<string>();
                    const color: ChipColor = value === 'active' ? 'success' : value === 'deprecated' ? 'warning' : value === 'retired' ? 'default' : 'default';
                    return <Chip size="small" color={color} variant={value ? 'filled' : 'outlined'} label={value || 'none'} />;
                },
            },
            {
                accessorKey: 'costTier',
                header: 'Cost Tier',
                filterVariant: 'select',
                filterSelectOptions: [
                    { label: 'Low', value: 'low' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'High', value: 'high' },
                ],
                Cell: ({ cell }) => {
                    const value = cell.getValue<string>();
                    const color: ChipColor = value === 'high' ? 'warning' : value === 'medium' ? 'info' : value === 'low' ? 'success' : 'default';
                    return <Chip size="small" color={color} variant={value ? 'filled' : 'outlined'} label={value || 'none'} />;
                },
            },
            { accessorKey: 'targetPersonas', header: 'Target Personas' },
            { accessorKey: 'descriptionSource', header: 'Description Source' },
            {
                accessorKey: 'descriptionManualOverride',
                header: 'Manual Override',
                Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
            },
            {
                accessorKey: 'descriptionEmbeddingStatus',
                header: 'Embedding Status',
                filterVariant: 'select',
                filterSelectOptions: [
                    { label: 'Pending', value: 'pending' },
                    { label: 'Running', value: 'running' },
                    { label: 'Ready', value: 'ready' },
                    { label: 'Failed', value: 'failed' },
                    { label: 'Disabled', value: 'disabled' },
                    { label: 'Blank', value: 'blank' },
                ],
                Cell: ({ cell }) => {
                    const status = cell.getValue<string>();
                    return <Chip size="small" color={embeddingStatusColor(status)} variant={status ? 'filled' : 'outlined'} label={status || 'none'} />;
                },
            },
            { accessorKey: 'descriptionEmbeddingModel', header: 'Embedding Model' },
            { accessorKey: 'descriptionEmbeddingDimension', header: 'Embedding Dimension' },
            {
                accessorKey: 'descriptionEmbeddingTs',
                header: 'Embedding Updated',
                Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
            },
            { accessorKey: 'descriptionEmbeddingError', header: 'Embedding Error' },
            { accessorKey: 'version', header: 'Version' },
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
        getRowId: (row) => row.toolId,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: true,
        positionActionsColumn: 'first',
        renderRowActions: ({ row }) => (
            <Box sx={{ display: 'flex', gap: '1rem' }}>
                <Tooltip title="Update Tool">
                    <IconButton
                        onClick={() => handleUpdate(row)}
                        disabled={isUpdateLoading === row.original.toolId}
                    >
                        {isUpdateLoading === row.original.toolId ? (
                            <CircularProgress size={22} />
                        ) : (
                            <SystemUpdateIcon />
                        )}
                    </IconButton>
                </Tooltip>
                <Tooltip title={row.original.descriptionEmbeddingStatus === 'failed' ? 'Retry Embedding' : 'Refresh Embedding'}>
                    <IconButton
                        onClick={() => handleRefreshEmbedding(row)}
                        disabled={!row.original.active || isEmbeddingRefreshLoading === row.original.toolId}
                    >
                        {isEmbeddingRefreshLoading === row.original.toolId ? (
                            <CircularProgress size={22} />
                        ) : (
                            <RefreshIcon />
                        )}
                    </IconButton>
                </Tooltip>
                <Tooltip title="Delete Tool">
                    <IconButton color="error" onClick={() => handleDelete(row)}>
                        <DeleteForeverIcon />
                    </IconButton>
                </Tooltip>
            </Box>
        ),
        renderTopToolbarCustomActions: () => (
            <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate(buildGenAiTaskRoute('/app/form/createTool', searchParams, taskContext))}>
                Create New Tool
            </Button>
        ),
    });

    return (
        <GenAiTaskLayout context={taskContext}>
            <MaterialReactTable table={table} />
        </GenAiTaskLayout>
    );
}
