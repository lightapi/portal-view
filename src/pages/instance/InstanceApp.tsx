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
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type InstanceAppApiResponse = {
  instanceApps: Array<InstanceAppType>;
  total: number;
};

type InstanceAppType = {
  hostId: string;
  instanceAppId: string;
  instanceId: string;
  instanceName?: string;
  productVersionId: string;
  productId?: string;
  productVersion?: string;
  appId: string;
  appVersion: string;
  active: boolean;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

export default function InstanceApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as { host: string };
  const initialData = location.state?.data || {};

  // Data and fetching state
  const [data, setData] = useState<InstanceAppType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state, pre-filtered by context if provided
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() => {
    const initialFilters: MRT_ColumnFiltersState = [
      { id: 'active', value: 'true' } // Default to active
    ];
    if (initialData.instanceId) initialFilters.push({ id: 'instanceId', value: initialData.instanceId });
    if (initialData.appId) initialFilters.push({ id: 'appId', value: initialData.appId });
    if (initialData.appVersion) initialFilters.push({ id: 'appVersion', value: initialData.appVersion });
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

    let activeStatus = true; // Default to true if not present
    const apiFilters: MRT_ColumnFiltersState = [];

    columnFilters.forEach(filter => {
      if (filter.id === 'active') {
        // Extract active status (assuming filter.value is 'true'/'false' string from select)
        activeStatus = filter.value === 'true' || filter.value === true;
      } else {
        // Keep other filters as is
        apiFilters.push(filter);
      }
    });

    const cmd = {
      host: 'lightapi.net', service: 'instance', action: 'getInstanceApp', version: '0.1.0',
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
      const json = (await response.json()) as InstanceAppApiResponse;
      setData(json.instanceApps || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<InstanceAppType>) => {
    if (!window.confirm(`Are you sure you want to delete instance app ${row.original.instanceName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(item => item.instanceAppId !== row.original.instanceAppId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'instance', action: 'deleteInstanceApp', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete instance app. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete instance app due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<InstanceAppType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'instanceAppId', header: 'Instance App Id' },
      { accessorKey: 'instanceId', header: 'Instance Id' },
      { accessorKey: 'instanceName', header: 'Instance Name' },
      { accessorKey: 'productVersionId', header: 'Product Version Id' },
      { accessorKey: 'productId', header: 'Product Id' },
      { accessorKey: 'productVersion', header: 'Product Version' },
      { accessorKey: 'appId', header: 'App Id' },
      { accessorKey: 'appVersion', header: 'App Version' },
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
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Delete Instance App"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
      },
      {
        id: 'relations', header: 'Config', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', gap: '0.1rem' }}>
            <Tooltip title="Config Properties"><IconButton onClick={() => navigate('/app/config/configInstanceApp', { state: { data: { instanceAppId: row.original.instanceAppId, instanceId: row.original.instanceId, appId: row.original.appId, appVersion: row.original.appVersion } } })}><AddToDriveIcon /></IconButton></Tooltip>
          </Box>
        ),
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
    getRowId: (row) => row.instanceAppId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate('/app/form/createInstanceApp', { state: { data: initialData } })}
          disabled={!initialData.instanceId}
        >
          Create New Instance App
        </Button>
        {initialData.instanceId && (
          <Typography variant="subtitle1">
            For Instance: <strong>{initialData.instanceId}</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
