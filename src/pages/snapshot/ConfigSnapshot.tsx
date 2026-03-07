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
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import ReceiptIcon from '@mui/icons-material/Receipt';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import ApiIcon from '@mui/icons-material/Api';
import AppsIcon from '@mui/icons-material/Apps';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TuneIcon from '@mui/icons-material/Tune';
import LanguageIcon from '@mui/icons-material/Language';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';

// --- Type Definitions ---
type ConfigSnapshotApiResponse = {
    snapshots: Array<ConfigSnapshotType>;
    total: number;
};

type ConfigSnapshotType = {
    snapshotId: string;
    snapshotTs: string;
    snapshotType: string;
    hostId: string;
    instanceId: string;
    instanceName: string;
    current: boolean;
    description: string;
    userId: string;
    deploymentId: string;
    environmentId: string;
    productId: string;
    productVersion: string;
    serviceId: string;
    apiId: string;
    apiVersion: string;
};

interface UserState {
    host?: string;
}

export default function ConfigSnapshot() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;
    const initialInstanceId = location.state?.data?.instanceId;

    // Data and fetching state
    const [data, setData] = useState<ConfigSnapshotType[]>([]);
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [rowCount, setRowCount] = useState(0);
    const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

    // Table state, pre-filtered by instanceId if provided
    const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() => {
        const initialFilters: MRT_ColumnFiltersState = [];
        if (initialInstanceId) initialFilters.push({ id: 'instanceId', value: initialInstanceId });
        initialFilters.push({ id: 'current', value: 'true' });
        return initialFilters;
    });

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

        const apiFilters: MRT_ColumnFiltersState = [];

        columnFilters.forEach(filter => {
            if (filter.id === 'current') {
                // Handle boolean conversion for specific columns
                apiFilters.push({ ...filter, value: filter.value === 'true' });
            } else {
                // Keep other filters as is
                apiFilters.push(filter);
            }
        });

        const cmd = {
            host: 'lightapi.net', service: 'config', action: 'getConfigSnapshot', version: '0.1.0',
            data: {
                hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
                sorting: JSON.stringify(sorting ?? []),
                filters: JSON.stringify(apiFilters ?? []),
                globalFilter: globalFilter ?? '',
            },
        };

        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const json = await fetchClient(url);
            console.log("Fetched Config Snapshots:", json);
            setData(json.snapshots || []);
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
    const handleDelete = useCallback(async (row: MRT_Row<ConfigSnapshotType>) => {
        if (!window.confirm(`Are you sure you want to delete this snapshot from the instance?`)) return;

        const originalData = [...data];
        setData(prev => prev.filter(item => !(
            item.instanceId === row.original.instanceId
        )));
        setRowCount(prev => prev - 1);

        const cmd = {
            host: 'lightapi.net', service: 'config', action: 'deleteSnapshot', version: '0.1.0',
            data: row.original,
        };

        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                alert('Failed to delete snapshot. Please try again.');
                setData(originalData);
                setRowCount(originalData.length);
            }
        } catch (e) {
            alert('Failed to delete snapshot due to a network error.');
            setData(originalData);
            setRowCount(originalData.length);
        }
    }, [data]);

    const handleUpdate = useCallback(async (row: MRT_Row<ConfigSnapshotType>) => {
        const snapshotId = row.original.snapshotId;
        setIsUpdateLoading(snapshotId);

        const cmd = {
            host: 'lightapi.net', service: 'config', action: 'getFreshConfigSnapshot', version: '0.1.0',
            data: row.original,
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

        try {
            const freshData = await fetchClient(url);
            console.log("freshData", freshData);

            // Navigate with the fresh data
            navigate('/app/form/updateConfigSnapshot', {
                state: {
                    data: freshData,
                    source: location.pathname
                }
            });
        } catch (error) {
            console.error("Failed to fetch config snapshot for update:", error);
            alert("Could not load the latest config snapshot data. Please try again.");
        } finally {
            setIsUpdateLoading(null);
        }
    }, [host, navigate, location.pathname]);

    // Column definitions
    const columns = useMemo<MRT_ColumnDef<ConfigSnapshotType>[]>(
        () => [
            { accessorKey: 'snapshotId', header: 'Snapshot Id' },
            { accessorKey: 'snapshotTs', header: 'Snapshot Ts' },
            { accessorKey: 'snapshotType', header: 'Snapshot Type' },
            { accessorKey: 'hostId', header: 'Host Id' },
            { accessorKey: 'instanceId', header: 'Instance Id' },
            { accessorKey: 'instanceName', header: 'Instance Name' },
            {
                accessorKey: 'current',
                header: 'Current',
                filterVariant: 'select',
                filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
                Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
            },
            { accessorKey: 'description', header: 'Description' },
            { accessorKey: 'userId', header: 'User Id' },
            { accessorKey: 'deploymentId', header: 'Deployment Id' },
            { accessorKey: 'environment', header: 'Environment' },
            { accessorKey: 'productId', header: 'Product Id' },
            { accessorKey: 'productVersion', header: 'Product Version' },
            { accessorKey: 'serviceId', header: 'Service Id' },
            { accessorKey: 'apiId', header: 'Api Id' },
            { accessorKey: 'apiVersion', header: 'Api Version' },
            {
                id: 'properties', header: 'Properties', enableSorting: false, enableColumnFilter: false,
                Cell: ({ row }) => (<Tooltip title="View Properties"><IconButton onClick={() => navigate('/app/config/configSnapshotProperty', { state: { data: row.original } })}><ReceiptIcon /></IconButton></Tooltip>),
            },
            {
                id: 'files', header: 'Files', enableSorting: false, enableColumnFilter: false,
                Cell: ({ row }) => (<Tooltip title="View Files"><IconButton onClick={() => navigate('/app/config/configSnapshotFile', { state: { data: row.original } })}><DescriptionIcon /></IconButton></Tooltip>),
            },
            {
                id: 'deploymentProps', header: 'Deployment Props', enableSorting: false, enableColumnFilter: false,
                Cell: ({ row }) => (<Tooltip title="View Deployment Props"><IconButton onClick={() => navigate('/app/config/configSnapshotDeploymentInstanceProperty', { state: { data: row.original } })}><SettingsIcon /></IconButton></Tooltip>),
            },
            {
                id: 'apiProps', header: 'API Props', enableSorting: false, enableColumnFilter: false,
                Cell: ({ row }) => (<Tooltip title="View API Props"><IconButton onClick={() => navigate('/app/config/configSnapshotInstanceApiProperty', { state: { data: row.original } })}><ApiIcon /></IconButton></Tooltip>),
            },
            {
                id: 'appProps', header: 'App Props', enableSorting: false, enableColumnFilter: false,
                Cell: ({ row }) => (<Tooltip title="View App Props"><IconButton onClick={() => navigate('/app/config/configSnapshotInstanceAppProperty', { state: { data: row.original } })}><AppsIcon /></IconButton></Tooltip>),
            },
            {
                id: 'appApiProps', header: 'App API Props', enableSorting: false, enableColumnFilter: false,
                Cell: ({ row }) => (<Tooltip title="View App API Props"><IconButton onClick={() => navigate('/app/config/configSnapshotInstanceAppApiProperty', { state: { data: row.original } })}><AccountTreeIcon /></IconButton></Tooltip>),
            },
            {
                id: 'instProps', header: 'Inst Props', enableSorting: false, enableColumnFilter: false,
                Cell: ({ row }) => (<Tooltip title="View Inst Props"><IconButton onClick={() => navigate('/app/config/configSnapshotInstanceProperty', { state: { data: row.original } })}><TuneIcon /></IconButton></Tooltip>),
            },
            {
                id: 'envProps', header: 'Env Props', enableSorting: false, enableColumnFilter: false,
                Cell: ({ row }) => (<Tooltip title="View Env Props"><IconButton onClick={() => navigate('/app/config/configSnapshotEnvironmentProperty', { state: { data: row.original } })}><LanguageIcon /></IconButton></Tooltip>),
            },
            {
                id: 'prdProps', header: 'Prd Props', enableSorting: false, enableColumnFilter: false,
                Cell: ({ row }) => (<Tooltip title="View Prd Props"><IconButton onClick={() => navigate('/app/config/configSnapshotProductProperty', { state: { data: row.original } })}><Inventory2Icon /></IconButton></Tooltip>),
            },
            {
                id: 'pvProps', header: 'PV Props', enableSorting: false, enableColumnFilter: false,
                Cell: ({ row }) => (<Tooltip title="View PV Props"><IconButton onClick={() => navigate('/app/config/configSnapshotProductVersionProperty', { state: { data: row.original } })}><FactCheckIcon /></IconButton></Tooltip>),
            },
            {
                id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
                Cell: ({ row }) => (<Tooltip title="Update Property"><IconButton onClick={() => handleUpdate(row)}><SystemUpdateIcon /></IconButton></Tooltip>),
            },
            {
                id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
                Cell: ({ row }) => (<Tooltip title="Delete Property"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
            },
        ],
        [handleDelete, navigate],
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
        getRowId: (row) => `${row.instanceId}-${row.snapshotId}`,
        muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
        enableRowActions: false,
        renderTopToolbarCustomActions: () => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                    variant="contained"
                    startIcon={<AddBoxIcon />}
                    onClick={() => navigate('/app/form/createConfigSnapshot', { state: { data: { instanceId: initialInstanceId } } })}
                    disabled={!initialInstanceId}
                >
                    Create Config Snapshot
                </Button>
                {initialInstanceId && (
                    <Typography variant="subtitle1">
                        For Instance: <strong>{initialInstanceId}</strong>
                    </Typography>
                )}
            </Box>
        ),
    });

    return <MaterialReactTable table={table} />;
}
