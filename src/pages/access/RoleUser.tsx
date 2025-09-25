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
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type RoleUserApiResponse = {
  roleUsers: Array<RoleUserType>;
  total: number;
};

type RoleUserType = {
  hostId: string;
  roleId: string;
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  userType?: string;
  entityId?: string;
  startTs?: string;
  endTs?: string;
  aggregateVersion?: number;
  updateUser?: string;
  updateTs?: string;
};

export default function RoleUser() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState();
  const initialRoleId = location.state?.data?.roleId;
  const initialUserId = location.state?.data?.userId;

  // Data and fetching state
  const [data, setData] = useState<RoleUserType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state, pre-filtered by context if provided
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() => {
    const initialFilters: MRT_ColumnFiltersState = [];
    if (initialRoleId) initialFilters.push({ id: 'roleId', value: initialRoleId });
    if (initialUserId) initialFilters.push({ id: 'userId', value: initialUserId });
    return initialFilters;
  });
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  // Data fetching logic
  const fetchData = useCallback(async () => {
    if (!host) return;
    if (!data.length) setIsLoading(true); else setIsRefetching(true);

    const cmd = {
      host: 'lightapi.net', service: 'role', action: 'queryRoleUser', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []), filters: JSON.stringify(columnFilters ?? []), globalFilter: globalFilter ?? '',
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as RoleUserApiResponse;
      setData(json.roleUsers || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<RoleUserType>) => {
    if (!window.confirm(`Are you sure you want to remove this user from the role?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(ru => !(ru.roleId === row.original.roleId && ru.userId === row.original.userId)));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'role', action: 'deleteRoleUser', version: '0.1.0',
      data: { ...row.original, aggregateVersion: row.original.aggregateVersion }, // Send the full row data as per original component
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to remove user from role. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to remove user from role due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<RoleUserType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'roleId', header: 'Role Id' },
      { accessorKey: 'userId', header: 'User Id' },
      { accessorKey: 'startTs', header: 'Start Ts' },
      { accessorKey: 'endTs', header: 'End Ts' },
      { accessorKey: 'email', header: 'Email' },
      { accessorKey: 'firstName', header: 'First Name' },
      { accessorKey: 'lastName', header: 'Last Name' },
      { accessorKey: 'userType', header: 'Type' },
      { accessorKey: 'entityId', header: 'Entity Id' },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
      { accessorKey: 'updateUser', header: 'Update User' },
      { accessorKey: 'updateTs', header: 'Update Timestamp' },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Remove User from Role">
            <IconButton color="error" onClick={() => handleDelete(row)}>
              <DeleteForeverIcon />
            </IconButton>
          </Tooltip>
        ),
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
    getRowId: (row) => `${row.roleId}-${row.userId}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate('/app/form/createRoleUser', { state: { data: { roleId: initialRoleId, userId: initialUserId } } })}
        >
          Add User to Role
        </Button>
        {initialRoleId && !initialUserId && (
          <Typography variant="subtitle1">
            Users for Role: <strong>{initialRoleId}</strong>
          </Typography>
        )}
        {initialUserId && !initialRoleId && (
          <Typography variant="subtitle1">
            Roles for User: <strong>{initialUserId}</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
