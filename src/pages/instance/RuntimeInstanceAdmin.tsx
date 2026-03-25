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
import { Box, Button, IconButton, Tooltip, CircularProgress } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';

// Define the shape of the API response
type RuntimeInstanceApiResponse = {
  runtimeInstances: Array<RuntimeInstanceType>;
  total: number;
};

// Define the type for a single runtime instance record
type RuntimeInstanceType = {
  hostId: string;
  runtimeInstanceId: string;
  serviceId: string;
  envTag?: string;
  ipAddress: string;
  portNumber: number;
  instanceStatus: string;
  aggregateVersion?: number;
  active: boolean;
  updateUser?: string;
  updateTs?: string;
};

export default function RuntimeInstanceAdmin() {
  const navigate = useNavigate();
  const { host } = useUserState() as { host: string };

  // Data and fetching state
  const [data, setData] = useState<RuntimeInstanceType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

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
    if (!data.length) setIsLoading(true);
    else setIsRefetching(true);

    let activeStatus = true;
    const apiFilters: MRT_ColumnFiltersState = [];

    columnFilters.forEach((filter) => {
      if (filter.id === 'active') {
        activeStatus = filter.value === 'true' || filter.value === true;
      } else {
        apiFilters.push(filter);
      }
    });

    const cmd = {
      host: 'lightapi.net',
      service: 'instance',
      action: 'getRuntimeInstance',
      version: '0.1.0',
      data: {
        hostId: host,
        offset: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(apiFilters ?? []),
        globalFilter: globalFilter ?? '',
        active: activeStatus,
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const json = await fetchClient(url);
      setData(json.runtimeInstances || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true);
      console.error(error);
    } finally {
      setIsError(false);
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler — uses Get Fresh then sends delete command
  const handleDelete = useCallback(
    async (row: MRT_Row<RuntimeInstanceType>) => {
      if (
        !window.confirm(
          `Are you sure you want to delete runtime instance: ${row.original.runtimeInstanceId}?`
        )
      )
        return;

      // Fetch fresh data first to ensure aggregateVersion is current
      const getFreshCmd = {
        host: 'lightapi.net',
        service: 'instance',
        action: 'getFreshRuntimeInstance',
        version: '0.1.0',
        data: row.original,
      };
      const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(getFreshCmd));

      let freshData: RuntimeInstanceType;
      try {
        freshData = await fetchClient(url);
      } catch (error) {
        alert('Could not fetch the latest runtime instance data. Please refresh and try again.');
        return;
      }

      const originalData = [...data];
      setData((prev) =>
        prev.filter((p) => p.runtimeInstanceId !== row.original.runtimeInstanceId)
      );
      setRowCount((prev) => prev - 1);

      const cmd = {
        host: 'lightapi.net',
        service: 'instance',
        action: 'deleteRuntimeInstance',
        version: '0.1.0',
        data: {
          hostId: freshData.hostId,
          runtimeInstanceId: freshData.runtimeInstanceId,
          aggregateVersion: freshData.aggregateVersion,
        },
      };

      try {
        const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
        if (result.error) {
          alert('Failed to delete runtime instance. Please try again.');
          setData(originalData);
          setRowCount(originalData.length);
        }
      } catch (e) {
        alert('Failed to delete runtime instance due to a network error.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    },
    [data]
  );

  // Update handler — fetches fresh data then navigates to update form
  const handleUpdate = useCallback(
    async (row: MRT_Row<RuntimeInstanceType>) => {
      const runtimeInstanceId = row.original.runtimeInstanceId;
      setIsUpdateLoading(runtimeInstanceId);

      const cmd = {
        host: 'lightapi.net',
        service: 'instance',
        action: 'getFreshRuntimeInstance',
        version: '0.1.0',
        data: row.original,
      };
      const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

      try {
        const freshData = await fetchClient(url);
        navigate('/app/form/updateRuntimeInstance', {
          state: {
            data: freshData,
            source: location.pathname,
          },
        });
      } catch (error) {
        console.error('Failed to fetch runtime instance for update:', error);
        alert('Could not load the latest runtime instance data. Please try again.');
      } finally {
        setIsUpdateLoading(null);
      }
    },
    [navigate]
  );

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<RuntimeInstanceType>[]>(
    () => [
      { accessorKey: 'serviceId', header: 'Service ID' },
      { accessorKey: 'envTag', header: 'Env Tag' },
      { accessorKey: 'ipAddress', header: 'IP Address' },
      { accessorKey: 'portNumber', header: 'Port' },
      { accessorKey: 'instanceStatus', header: 'Status' },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [
          { label: 'True', value: 'true' },
          { label: 'False', value: 'false' },
        ],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      { accessorKey: 'runtimeInstanceId', header: 'Runtime Instance Id' },
      { accessorKey: 'hostId', header: 'Host Id', enableColumnFilter: false },
      { accessorKey: 'updateUser', header: 'Update User' },
      {
        accessorKey: 'updateTs',
        header: 'Update Time',
        Cell: ({ cell }) =>
          cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
      },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
    ],
    []
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
    getRowId: (row) => row.runtimeInstanceId,
    muiToolbarAlertBannerProps: isError
      ? { color: 'error', children: 'Error loading data' }
      : undefined,
    enableRowActions: true,
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.1rem' }}>
        <Tooltip title="Update Runtime Instance">
          <IconButton
            onClick={() => handleUpdate(row)}
            disabled={isUpdateLoading === row.original.runtimeInstanceId}
          >
            {isUpdateLoading === row.original.runtimeInstanceId ? (
              <CircularProgress size={22} />
            ) : (
              <SystemUpdateIcon />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete Runtime Instance">
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
        onClick={() => navigate('/app/form/createRuntimeInstance')}
      >
        Create Runtime Instance
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
