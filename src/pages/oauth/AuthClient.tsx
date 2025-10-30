import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
  type MRT_Row,
} from 'material-react-table';
import { Box, Button, IconButton, Tooltip, Typography, CircularProgress } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type AuthClientApiResponse = {
  clients: Array<AuthClientType>; // Assuming the API returns a 'clients' array
  total: number;
};

type AuthClientType = {
  hostId: string;
  clientId: string;
  clientName: string;
  appId?: string;
  apiId?: string;
  clientType: 'public' | 'confidential' | 'trusted' | 'external';
  clientProfile: 'webserver' | 'mobile' | 'browser' | 'service' | 'batch';
  clientSecret: string;
  clientScope?: string;
  customClaim?: string;
  redirectUri?: string;
  authenticateClass?: string;
  derefClientId?: string;
  active: boolean;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

export default function AuthClient() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState();
  const initialData = location.state?.data || {};

  // Data and fetching state
  const [data, setData] = useState<AuthClientType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  // Table state, pre-filtered by context if provided
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() =>
    Object.entries(initialData)
      .map(([id, value]) => ({ id, value: value as string }))
      .filter(f => f.value),
  );
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
      if (filter.id === 'active') {
        return { ...filter, value: filter.value === 'true' };
      }
      return filter;
    });

    const cmd = {
      host: 'lightapi.net', service: 'oauth', action: 'getClient', version: '0.1.0',
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
      const json = (await response.json()) as AuthClientApiResponse;
      setData(json.clients || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<AuthClientType>) => {
    if (!window.confirm(`Are you sure you want to delete client: ${row.original.clientName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(client => client.clientId !== row.original.clientId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'client', action: 'deleteClient', version: '0.1.0',
      data: { ...row.original, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete client. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete client due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  const handleUpdate = useCallback(async (row: MRT_Row<AuthClientType>) => {
    // Similar to ClientApp, fetch the latest data before navigating
    const clientId = row.original.clientId;
    setIsUpdateLoading(clientId);

    const cmd = { /* ... command to get a single client by ID ... */ };
    // ... fetch logic ...
    
    // On success:
    // navigate('/app/form/updateClient', { state: { data: freshData, source: location.pathname } });

    // For now, let's just navigate with the potentially stale data
    navigate('/app/form/updateClient', { state: { data: row.original, source: location.pathname } });
    
  }, [navigate, location.pathname]);


  // Column definitions
  const columns = useMemo<MRT_ColumnDef<AuthClientType>[]>(
    () => [
      { accessorKey: 'clientId', header: 'Client ID' },
      { accessorKey: 'clientName', header: 'Client Name' },
      { accessorKey: 'appId', header: 'App ID' },
      { accessorKey: 'apiId', header: 'API ID' },
      { accessorKey: 'clientType', header: 'Type' },
      { accessorKey: 'clientProfile', header: 'Profile' },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
      },
      {
        id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Update Client"><IconButton onClick={() => handleUpdate(row)}><SystemUpdateIcon /></IconButton></Tooltip>),
      },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Delete Client"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
      },
    ],
    [handleDelete, handleUpdate],
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
    getRowId: (row) => row.clientId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate('/app/form/createClient', { state: { data: initialData } })}
        >
          Create New Client
        </Button>
        {initialData.appId && (
            <Typography variant="subtitle1">
                For App: <strong>{initialData.appId}</strong>
            </Typography>
        )}
        {initialData.apiId && (
            <Typography variant="subtitle1">
                For API: <strong>{initialData.apiId}</strong>
            </Typography>
        )}
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
