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
import SettingsIcon from '@mui/icons-material/Settings';
import { apiPost } from '../../api/apiPost';
import Cookies from 'universal-cookie';

// Define the shape of the API response
type HostApiResponse = {
  hosts: Array<HostType>;
  total: number;
};

// Define the type for a single host record
type HostType = {
  hostId: string;
  currentHostId: string;
  domain: string;
  subDomain: string;
  hostDesc?: string;
  hostOwner?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

export default function HostAdmin() {
  const navigate = useNavigate();

  // Data and fetching state
  const [data, setData] = useState<HostType[]>([]);
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
    console.log("fetchData is called.", data);
    if (!data.length) {
      setIsLoading(true);
    } else {
      setIsRefetching(true);
    }

    const cmd = {
      host: 'lightapi.net',
      service: 'host',
      action: 'getHost',
      version: '0.1.0',
      data: {
        offset: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(columnFilters ?? []),
        globalFilter: globalFilter ?? '',
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      console.log("call the fetch api");
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as HostApiResponse;
      console.log(json);
      setData(json.hosts);
      setRowCount(json.total);
    } catch (error) {
      setIsError(true);
      console.error(error);
    } finally {
      setIsError(false);
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [
    columnFilters,
    globalFilter,
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
  ]);

  // useEffect to trigger fetchData when table state changes
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    columnFilters,
    globalFilter,
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
  ]);

  // Delete handler
  const handleDelete = useCallback(async (row: MRT_Row<HostType>) => {
    if (!window.confirm(`Are you sure you want to delete host: ${row.original.subDomain}?`)) {
      return;
    }

    // Keep a copy of the current data in case we need to roll back
    const originalData = [...data];

    // Optimistically update the UI
    setData(prevData => prevData.filter(host => host.currentHostId !== row.original.currentHostId));
    setRowCount(prev => prev - 1); // Also optimistically update the total count

    const cmd = {
      host: 'lightapi.net',
      service: 'host',
      action: 'deleteHost',
      version: '0.1.0',
      data: { hostId: row.original.currentHostId, aggregateVersion: row.original.aggregateVersion },
    };
    
    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        // On failure, revert the UI and show an error
        console.error('API Error on delete:', result.error);
        alert('Failed to delete host. Please try again.'); // Or use a snackbar
        setData(originalData);
        setRowCount(originalData.length); // Revert the count
      }
      // On success, do nothing! The UI is already correct.
      // You could trigger a silent background refetch here if you want to be 100% in sync, but it's often not necessary.

    } catch (e) {
      // Also handle network errors
      console.error('Network Error on delete:', e);
      alert('Failed to delete host due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]); // The main dependency is the 'data' for rollback.


  // Column definitions
  const columns = useMemo<MRT_ColumnDef<HostType>[]>(
    () => [
      { accessorKey: 'currentHostId', header: 'HostId' },
      { accessorKey: 'domain', header: 'Domain' },
      { accessorKey: 'subDomain', header: 'SubDomain' },
      { accessorKey: 'hostDesc', header: 'Description' },
      { accessorKey: 'hostOwner', header: 'Owner' },
      { accessorKey: 'aggregateVersion', header: 'AggregateVersion' },
      { accessorKey: 'updateUser', header: 'Update User' },
      {
        accessorKey: 'updateTs',
        header: 'Update Time',
        Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
      },
    ],  
    [],
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
    state: {
      isLoading,
      showAlertBanner: isError,
      showProgressBars: isRefetching,
      pagination,
      sorting,
      columnFilters,
      globalFilter,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.currentHostId,
    muiToolbarAlertBannerProps: isError
      ? { color: 'error', children: 'Error loading data' }
      : undefined,
    
    enableRowActions: true,
    positionActionsColumn: 'last',
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.5rem' }}>
        <Tooltip title="Details">
          <IconButton onClick={() => navigate('/app/host/hostDetail', { state: { data: { hostId: row.original.hostId } } })}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Update">
          <IconButton onClick={() => navigate('/app/form/updateHost', { state: { data: { ...row.original } } })}>
            <SystemUpdateIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton color="error" onClick={() => handleDelete(row)}>
            <DeleteForeverIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    
    renderTopToolbarCustomActions: () => (
      <Button
        variant="contained"
        startIcon={<AddBoxIcon />}
        onClick={() => navigate('/app/form/createHost')}
      >
        Create New Host
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
