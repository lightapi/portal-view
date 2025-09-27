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
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import DoNotTouchIcon from '@mui/icons-material/DoNotTouch';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import GroupsIcon from '@mui/icons-material/Groups';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type GroupApiResponse = {
  groups: Array<GroupType>;
  total: number;
};

type GroupType = {
  hostId: string;
  groupId: string;
  groupDesc?: string;
  aggregateVersion?: number;
  updateUser: string;
  updateTs: string;
};

export default function GroupAdmin() {
  const navigate = useNavigate();
  const { host } = useUserState();

  // Data and fetching state
  const [data, setData] = useState<GroupType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
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
      host: 'lightapi.net', service: 'group', action: 'getGroup', version: '0.1.0',
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
      const json = (await response.json()) as GroupApiResponse;
      setData(json.groups || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<GroupType>) => {
    if (!window.confirm(`Are you sure you want to delete group: ${row.original.groupId}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(group => group.groupId !== row.original.groupId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'group', action: 'deleteGroup', version: '0.1.0',
      data: { ...row.original, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete group. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete group due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<GroupType>[]>(
    () => [
      { accessorKey: 'groupId', header: 'Group ID' },
      { accessorKey: 'groupDesc', header: 'Description' },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
      { accessorKey: 'updateUser', header: 'Update User' },
      { accessorKey: 'updateTs', header: 'Update Timestamp' },
      {
        id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (<Tooltip title="Update Group"><IconButton onClick={() => navigate('/app/form/updateGroup', { state: { data: { ...row.original } } })}><SystemUpdateIcon /></IconButton></Tooltip>),
      },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (<Tooltip title="Delete Group"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
      },
      {
        id: 'accessControl', header: 'Access Control', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', gap: '0.1rem' }}>
            <Tooltip title="Group Permissions"><IconButton onClick={() => navigate('/app/access/groupPermission', { state: { data: { groupId: row.original.groupId } } })}><DoNotTouchIcon /></IconButton></Tooltip>
            <Tooltip title="Group Row Filters"><IconButton onClick={() => navigate('/app/access/groupRowFilter', { state: { data: { groupId: row.original.groupId } } })}><KeyboardDoubleArrowDownIcon /></IconButton></Tooltip>
            <Tooltip title="Group Column Filters"><IconButton onClick={() => navigate('/app/access/groupColFilter', { state: { data: { groupId: row.original.groupId } } })}><KeyboardDoubleArrowRightIcon /></IconButton></Tooltip>
            <Tooltip title="Manage Users"><IconButton onClick={() => navigate('/app/access/groupUser', { state: { data: { groupId: row.original.groupId } } })}><GroupsIcon /></IconButton></Tooltip>
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
    getRowId: (row) => row.groupId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createGroup')}>
        Create New Group
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
