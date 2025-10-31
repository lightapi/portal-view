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
import KeyIcon from '@mui/icons-material/Key';
import ApiIcon from '@mui/icons-material/Api';
import AppsIcon from '@mui/icons-material/Apps';
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import Cookies from 'universal-cookie';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';

// --- Type Definitions ---
type AuthProviderApiResponse = {
  providers: Array<AuthProviderType>;
  total: number;
};

type AuthProviderType = {
  hostId: string;
  providerId: string;
  providerName?: string;
  providerDesc?: string;
  operationOwner?: string;
  deliveryOwner?: string;
  jwk?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
  active: boolean;
};

// Helper Cell component for truncating long text with a tooltip
const TruncatedCell = <T extends MRT_RowData>({ cell }: { cell: MRT_Cell<T, unknown> }) => {
    const value = cell.getValue<string>() ?? '';
    return (
        <Tooltip title={value} placement="top-start">
            <Box component="span" sx={{ display: 'block', maxWidth: '200px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {value}
            </Box>
        </Tooltip>
    );
};

export default function AuthProvider() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState();

  // Data and fetching state
  const [data, setData] = useState<AuthProviderType[]>([]);
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

    // Transform string booleans from the UI filter state to real booleans for the API
    const apiFilters = columnFilters.map(filter => {
      if (filter.id === 'active') {
        return {
          ...filter,
          value: filter.value === 'true', // This converts "true" to true and "false" (or anything else) to false
        };
      }
      return filter; // Return all other filters unchanged
    });

    const cmd = {
      host: 'lightapi.net', service: 'oauth', action: 'getProvider', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []), filters: JSON.stringify(apiFilters ?? []), globalFilter: globalFilter ?? '',
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as AuthProviderApiResponse;
      setData(json.providers || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<AuthProviderType>) => {
    if (!window.confirm(`Are you sure you want to delete provider: ${row.original.providerName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(p => p.providerId !== row.original.providerId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'oauth', action: 'deleteProvider', version: '0.1.0',
      data: { ...row.original, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete provider. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete provider due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  const handleUpdate = useCallback(async (row: MRT_Row<AuthProviderType>) => {
    const providerId = row.original.providerId;
    setIsUpdateLoading(providerId);

    const cmd = {
      host: 'lightapi.net', service: 'oauth', action: 'getFreshProvider', version: '0.1.0',
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
        throw new Error(freshData.description || 'Failed to fetch latest data.');
      }
      
      // Navigate with the fresh data
      navigate('/app/form/updateProvider', { 
        state: { 
          data: freshData, 
          source: location.pathname 
        } 
      });
    } catch (error) {
      console.error("Failed to fetch for update:", error);
      alert("Could not load the latest data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<AuthProviderType>[]>(
    () => [
      { accessorKey: 'providerId', header: 'Provider ID' },
      { accessorKey: 'providerName', header: 'Provider Name' },
      { 
        accessorKey: 'providerDesc', 
        header: 'Description',
        Cell: TruncatedCell,
        muiTableBodyCellProps: { sx: { maxWidth: '150px' } }
      },
      { accessorKey: 'operationOwner', header: 'Ops Owner' },
      { accessorKey: 'deliveryOwner', header: 'Dly Owner' },
      { 
        accessorKey: 'jwk', 
        header: 'JWK',
        Cell: TruncatedCell,
        muiTableBodyCellProps: { sx: { maxWidth: '150px' } }
      },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
      { accessorKey: 'updateUser', header: 'Update User' },
      { accessorKey: 'updateTs', header: 'Update Timestamp' },
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
          <Tooltip title="Update Provider">
            <IconButton 
              onClick={() => handleUpdate(row)}
              disabled={isUpdateLoading === row.original.providerId}
            >
              {isUpdateLoading === row.original.providerId ? (
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
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (<Tooltip title="Delete Provider"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
      },
      {
        id: 'oauthConfig', header: 'OAuth Config', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', gap: '0.1rem' }}>
            <Tooltip title="Manage Keys"><IconButton onClick={() => navigate('/app/oauth/providerKey', { state: { data: { ...row.original } } })}><KeyIcon /></IconButton></Tooltip>
            <Tooltip title="Manage Services"><IconButton onClick={() => navigate('/app/oauth/providerService', { state: { data: { ...row.original } } })}><ApiIcon /></IconButton></Tooltip>
            <Tooltip title="Manage Clients"><IconButton onClick={() => navigate('/app/oauth/providerClient', { state: { data: { ...row.original } } })}><AppsIcon /></IconButton></Tooltip>
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
    getRowId: (row) => row.providerId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createProvider')}>
        Create New Provider
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
