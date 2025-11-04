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
type UserHostApiResponse = {
  userHosts: Array<UserHostType>;
  total: number;
};

type UserHostType = {
  hostId: string;
  domain?: string;
  subDomain?: string;
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  current?: boolean;
  active: boolean;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

interface UserState {
  host?: string;
}

export default function HostUser() {
  const navigate = useNavigate();
  const location = useLocation();
  // We still get the user's context host, but it's not the primary ID for the query anymore.
  const { host: userContextHost } = useUserState() as UserState; 
  const initialHostId = location.state?.data?.hostId;
  console.log("initialHostId = ", initialHostId);
  // Data and fetching state
  const [data, setData] = useState<UserHostType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state, pre-filtered by context if provided
const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
  initialHostId 
    ? [
        { id: 'hostId', value: initialHostId },
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
    // Use initialHostId for the query. Do not proceed if it's missing.
    if (!initialHostId) {
        console.error("No hostId provided to HostUser page.");
        setIsError(true);
        return;
    }
    if (!data.length) setIsLoading(true); else setIsRefetching(true);

    const apiFilters = columnFilters.map(filter => {
      // Add the IDs of all your boolean columns to this check
      if (filter.id === 'active' || filter.id === 'current') {
        return {
          ...filter,
          value: filter.value === 'true',
        };
      }
      return filter;
    });

    const cmd = {
      host: 'lightapi.net', service: 'host', action: 'getUserHost', version: '0.1.0',
      data: {
        hostId: initialHostId, 
        offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []), filters: JSON.stringify(apiFilters ?? []), globalFilter: globalFilter ?? '',
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as UserHostApiResponse;
      setData(json.userHosts || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [initialHostId, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, data.length]);

  // useEffect to trigger fetchData
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<UserHostType>) => {
    if (!window.confirm(`Are you sure you want to remove user ${row.original.email} from this host?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(userHost => !(userHost.hostId === row.original.hostId && userHost.userId === row.original.userId)));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'host', action: 'deleteUserHost', version: '0.1.0', // Assuming this action exists
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to remove user from host. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to remove user from host due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<UserHostType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host ID' },
      { accessorKey: 'userId', header: 'User ID' },
      { accessorKey: 'email', header: 'Email' },
      { accessorKey: 'firstName', header: 'First Name' },
      { accessorKey: 'lastName', header: 'Last Name' },
      { accessorKey: 'updateUser', header: 'Update User' },
      { accessorKey: 'updateTs', header: 'Update Ts' },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
      {
        accessorKey: 'current',
        header: 'Current',
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      {
        id: 'delete', header: 'Remove', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Remove User from Host"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
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
    getRowId: (row) => `${row.hostId}-${row.userId}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate('/app/form/createUserHost', { state: { data: { hostId: initialHostId } } })}
          disabled={!initialHostId}
        >
          Add User to Host
        </Button>
        {initialHostId && (
          <Typography variant="subtitle1">
            Users for Host: <strong>{initialHostId}</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
