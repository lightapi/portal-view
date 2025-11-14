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
import { Box, Button, IconButton, Tooltip, CircularProgress } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import AirlineSeatReclineNormalIcon from '@mui/icons-material/AirlineSeatReclineNormal';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type AppApiResponse = {
  apps: Array<AppType>;
  total: number;
};

type AppType = {
  hostId: string;
  appId: string;
  appName?: string;
  appDesc?: string;
  isKafkaApp?: boolean;
  operationOwner?: string;
  deliveryOwner?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
  active: boolean;
};

interface UserState {
  host?: string;
}

export default function ClientApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;

  // Data and fetching state
  const [data, setData] = useState<AppType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  // Table state
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([
    { id: 'active', value: 'true' },
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
    
    const apiFilters = columnFilters.map(filter => {
      // Add the IDs of all your boolean columns to this check
      if (filter.id === 'active' || filter.id === 'isKafkaApp') {
        return {
          ...filter,
          value: filter.value === 'true',
        };
      }
      return filter;
    });

    const cmd = {
      host: 'lightapi.net', service: 'client', action: 'getApp', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []), 
        filters: JSON.stringify(apiFilters ?? []), 
        globalFilter: globalFilter ?? '',
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as AppApiResponse;
      setData(json.apps || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<AppType>) => {
    if (!window.confirm(`Are you sure you want to delete app: ${row.original.appName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(app => app.appId !== row.original.appId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'client', action: 'deleteApp', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete app. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete app due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Handler to fetch fresh data before navigating to update form
  const handleUpdate = useCallback(async (row: MRT_Row<AppType>) => {
    const appId = row.original.appId;
    setIsUpdateLoading(appId);

    const cmd = {
      host: 'lightapi.net', service: 'client', action: 'getAppById', version: '0.1.0',
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
        throw new Error(freshData.description || 'Failed to fetch latest app data.');
      }
      
      // Navigate with the fresh data
      navigate('/app/form/updateApp', { 
        state: { 
          data: freshData, 
          source: location.pathname 
        } 
      });
    } catch (error) {
      console.error("Failed to fetch app for update:", error);
      alert("Could not load the latest app data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<AppType>[]>(
    () => [
      { accessorKey: 'appId', header: 'App ID' },
      { accessorKey: 'appName', header: 'App Name' },
      { accessorKey: 'appDesc', header: 'Description' },
      {
        accessorKey: 'isKafkaApp',
        header: 'Kafka App',
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      { accessorKey: 'operationOwner', header: 'Ops Owner' },
      { accessorKey: 'updateUser', header: 'Update User' },
      { accessorKey: 'updateTs', header: 'Update Timestamp' },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
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
          <Tooltip title="Update App">
            <IconButton 
              onClick={() => handleUpdate(row)}
              disabled={isUpdateLoading === row.original.appId}
            >
              {isUpdateLoading === row.original.appId ? (
                <CircularProgress size={22} />
              ) : (
                <SystemUpdateIcon />
              )}
            </IconButton>
          </Tooltip>
        ),
      },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Delete App"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
      },
      {
        id: 'relations', header: 'Relations', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', gap: '0.1rem' }}>
            <Tooltip title="OAuth Clients"><IconButton onClick={() => navigate('/app/oauth/authClient', { state: { data: { hostId: row.original.hostId, appId: row.original.appId } } })}><AirlineSeatReclineNormalIcon /></IconButton></Tooltip>
            <Tooltip title="Instance Apps"><IconButton onClick={() => navigate('/app/instance/InstanceApp', { state: { data: { hostId: row.original.hostId, appId: row.original.appId } } })}><ContentCopyIcon /></IconButton></Tooltip>
          </Box>
        ),
      },
    ],
    [handleDelete, handleUpdate, isUpdateLoading, navigate],
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
    getRowId: (row) => row.appId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createApp')}>
        Create New App
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
