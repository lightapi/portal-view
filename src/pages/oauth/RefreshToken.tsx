import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
  type MRT_Row,
} from 'material-react-table';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import Cookies from 'universal-cookie';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';

// --- Type Definitions ---
type RefreshTokenApiResponse = {
  tokens: Array<RefreshTokenType>;
  total: number;
};

type RefreshTokenType = {
  hostId: string;
  refreshToken: string;
  providerId: string;
  userId: string;
  entityId: string;
  userType: string;
  email: string;
  roles?: string;
  groups?: string;
  positions?: string;
  attributes?: string;
  clientId: string;
  scope?: string;
  csrf?: string;
  customClaim?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

interface UserState {
  host?: string;
}

// Helper Cell component for truncating long text with a tooltip
// We make the component generic with `<T extends MRT_RowData>`
// This means it can work with any specific row type, like RefreshTokenType.
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

export default function RefreshTokenAdmin() {
  const { host } = useUserState() as UserState;

  // Data and fetching state
  const [data, setData] = useState<RefreshTokenType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    [
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
      host: 'lightapi.net', service: 'oauth', action: 'getRefreshToken', version: '0.1.0',
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
      const json = (await response.json()) as RefreshTokenApiResponse;
      setData(json.tokens || []);
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

  // Delete (Revoke) handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<RefreshTokenType>) => {
    if (!window.confirm(`Are you sure you want to revoke this refresh token for user: ${row.original.email}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(token => token.refreshToken !== row.original.refreshToken));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'oauth', action: 'deleteRefreshToken', version: '0.1.0', // Assuming this action exists
      data: { refreshToken: row.original.refreshToken, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to revoke token. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to revoke token due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<RefreshTokenType>[]>(
    () => [
      { accessorKey: 'userId', header: 'User ID' },
      { accessorKey: 'email', header: 'Email' },
      { accessorKey: 'clientId', header: 'Client ID' },
      {
        accessorKey: 'refreshToken',
        header: 'Refresh Token',
        Cell: TruncatedCell,
      },
      {
        accessorKey: 'scope',
        header: 'Scope',
        Cell: TruncatedCell,
      },
      {
        accessorKey: 'roles',
        header: 'Roles',
        Cell: TruncatedCell,
      },
      {
        accessorKey: 'updateTs', header: 'Last Updated',
        Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
      },
      {
        id: 'delete', header: 'Revoke', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Revoke Token"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
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
    getRowId: (row) => row.refreshToken,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading refresh tokens' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Typography variant="h5">
        Refresh Tokens
      </Typography>
    ),
  });

  return <MaterialReactTable table={table} />;
}
