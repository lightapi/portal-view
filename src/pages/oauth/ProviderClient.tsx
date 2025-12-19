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
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useUserState } from "../../contexts/UserContext.tsx";
import { apiPost } from "../../api/apiPost.ts";
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type ProviderClientApiResponse = {
  authProviderClients: Array<ProviderClientType>;
  total: number;
};

type ProviderClientType = {
  hostId: string;
  clientId: string;
  providerId: string;
  active: boolean;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

interface UserState {
  host?: string;
}

export default function ProviderClient() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;
  const initialProviderId = location.state?.data?.providerId;

  // Data and fetching state
  const [data, setData] = useState<ProviderClientType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state, pre-filtered by context if provided
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    initialProviderId
      ? [
        { id: 'providerId', value: initialProviderId },
        { id: 'active', value: 'true' }
      ]
      : [
        { id: 'active', value: 'true' }
      ]
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
      host: 'lightapi.net', service: 'oauth', action: 'getProviderClient', version: '0.1.0', // Assuming this is the correct action
      data: {
        hostId: host,
        offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
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
      const json = (await response.json()) as ProviderClientApiResponse;
      setData(json.authProviderClients || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<ProviderClientType>) => {
    if (!window.confirm(`Are you sure you want to remove client ${row.original.clientId} from this provider?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(pc => !(pc.providerId === row.original.providerId && pc.clientId === row.original.clientId)));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'oauth', action: 'deleteProviderClient', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to remove client from provider. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to remove client from provider due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<ProviderClientType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host ID' },
      { accessorKey: 'clientId', header: 'Client ID' },
      { accessorKey: 'providerId', header: 'Provider ID' },
      { accessorKey: 'updateUser', header: 'Update User' },
      { accessorKey: 'updateTs', header: 'Update Ts', Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '' },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
      },
      {
        id: 'delete', header: 'Remove', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Remove Client from Provider"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
      },
    ],
    [handleDelete],
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
    getRowId: (row) => `${row.hostId}-${row.clientId}-${row.providerId}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate('/app/form/createProviderClient', { state: { data: { providerId: initialProviderId, hostId: host } } })}
          disabled={!initialProviderId}
        >
          Add Client to Provider
        </Button>
        {initialProviderId && (
          <Typography variant="subtitle1">
            Clients for Provider: <strong>{initialProviderId}</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
